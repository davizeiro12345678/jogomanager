import {
  clearLocalCareerSyncBlock,
  isVersionedOutboxEntry,
  loadLocalCareer,
  queueSync,
  readCareerEpoch,
  readLocalCareerGeneration,
  readLocalCareerSyncBlock,
  readLocalCareerTombstone,
  readOutbox,
  saveLocalCareer,
  withCareerLock,
  type LocalOwnerId,
} from "./offline/store";

/**
 * Retry only the interrupted local-write barrier. Deletion, legacy queues and
 * generation conflicts require explicit reconciliation and never pass here.
 */
export async function recoverPendingCareerWrite({
  owner,
  epoch,
  isCurrent,
}: {
  owner: LocalOwnerId;
  epoch: number;
  isCurrent: () => boolean;
}): Promise<boolean> {
  const active = () => isCurrent() && readCareerEpoch(owner) === epoch;
  if (!active()) return false;
  try {
    const locked = await withCareerLock(
      owner,
      async () => {
        if (!active()) return false;
        const block = await readLocalCareerSyncBlock(owner);
        if (!active() || block?.reason !== "pending_save") return false;
        const generation = await readLocalCareerGeneration(owner);
        if (!active() || generation === null || generation !== block.generation) return false;
        const tombstone = await readLocalCareerTombstone(owner);
        if (!active() || tombstone) return false;
        const state = await loadLocalCareer(owner);
        if (!active() || !state) return false;
        const existing = await readOutbox(owner);
        if (
          !active() ||
          (existing && (!isVersionedOutboxEntry(existing) || existing.generation !== generation))
        )
          return false;
        const options = {
          lockHeld: true,
          expectedEpoch: epoch,
          generation,
          allowPendingBarrier: true,
        };
        if (!(await saveLocalCareer(state, "recuperação", owner, options)) || !active())
          return false;
        const queued = await queueSync(state, owner, options);
        if (!active() || !queued || !isVersionedOutboxEntry(queued)) return false;
        const confirmed = await readOutbox(owner);
        if (
          !active() ||
          !isVersionedOutboxEntry(confirmed) ||
          confirmed.revision !== queued.revision ||
          confirmed.generation !== generation
        )
          return false;
        return (
          (await clearLocalCareerSyncBlock(owner, { lockHeld: true, expectedEpoch: epoch })) &&
          active()
        );
      },
      epoch,
    );
    return locked.acquired && locked.value === true && active();
  } catch {
    return false;
  }
}
