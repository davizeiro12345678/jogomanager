import { canResetCareer, type CareerHydrationStatus } from "./career-hydration";

export interface CareerResetTombstone {
  generation: number;
  deletedAt: string;
}

export type CareerResetSyncState = "local" | "syncing" | "synced" | "pending" | "offline";
export type CareerResetOwner = string | null;
export type CareerResetFailureReason =
  | "preflight"
  | "lock_unavailable"
  | "remote_unconfirmed"
  | "tombstone_persist_failed"
  | "identity_changed"
  | "guest_coordination_unavailable"
  | "local_cleanup_failed";

export type CareerResetOutcome =
  | { ok: true; tombstone?: CareerResetTombstone }
  | { ok: false; reason: CareerResetFailureReason; tombstone?: CareerResetTombstone };

export interface CareerResetDependencies {
  status: CareerHydrationStatus;
  owner: CareerResetOwner;
  userId: string | null | undefined;
  getSync: () => CareerResetSyncState;
  isSaving: () => boolean;
  isOnline: () => boolean;
  isCurrentOwner: (owner: CareerResetOwner) => boolean;
  readOutbox: (owner: CareerResetOwner) => Promise<unknown | null>;
  hasSyncBlock?: (owner: CareerResetOwner) => Promise<boolean>;
  wipeRemote: (userId: string) => Promise<unknown>;
  persistTombstone?: (owner: CareerResetOwner, tombstone: CareerResetTombstone) => Promise<boolean>;
  clearLocal: (owner: CareerResetOwner) => Promise<boolean>;
  beginReset?: (owner: CareerResetOwner) => boolean;
  withCrossTabLock?: <T>(
    owner: CareerResetOwner,
    callback: () => Promise<T> | T,
  ) => Promise<{ acquired: boolean; value?: T }>;
}

function hasPendingSync(sync: CareerResetSyncState): boolean {
  return sync === "pending" || sync === "syncing";
}

function parseTombstone(value: unknown): CareerResetTombstone | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<CareerResetTombstone>;
  const generation = candidate.generation;
  if (
    typeof generation !== "number" ||
    !Number.isSafeInteger(generation) ||
    generation < 1 ||
    typeof candidate.deletedAt !== "string" ||
    candidate.deletedAt.length === 0
  )
    return null;
  return { generation, deletedAt: candidate.deletedAt };
}

function failure(
  reason: CareerResetFailureReason,
  tombstone?: CareerResetTombstone,
): CareerResetOutcome {
  return tombstone ? { ok: false, reason, tombstone } : { ok: false, reason };
}

async function hasBlockingSyncState(deps: CareerResetDependencies, owner: CareerResetOwner) {
  if (!deps.hasSyncBlock) return false;
  try {
    return await deps.hasSyncBlock(owner);
  } catch {
    // An unreadable barrier is not evidence that destructive reset is safe.
    return true;
  }
}

/**
 * Reset a signed-in career only after its remote tombstone is confirmed.
 * Outcomes distinguish a blocked preflight from a confirmed remote deletion
 * whose local cleanup still needs recovery. Guest careers remain local-only.
 */
export async function resetCareerSafely(
  deps: CareerResetDependencies,
): Promise<CareerResetOutcome> {
  const { status, owner, userId, getSync, isSaving, isOnline, isCurrentOwner } = deps;
  const reset = async (): Promise<CareerResetOutcome> => {
    if (userId === undefined || !canResetCareer(status)) return failure("preflight");
    if (!isCurrentOwner(owner)) return failure("identity_changed");
    if (hasPendingSync(getSync()) || isSaving()) return failure("preflight");
    if (await hasBlockingSyncState(deps, owner)) return failure("preflight");

    let tombstone: CareerResetTombstone | undefined;
    if (userId !== null) {
      if (owner !== userId || getSync() === "offline" || !isOnline()) return failure("preflight");
      let pending: unknown | null;
      try {
        pending = await deps.readOutbox(owner);
      } catch {
        return failure("preflight");
      }
      const currentSync = getSync();
      if (
        pending ||
        !isCurrentOwner(owner) ||
        !isOnline() ||
        currentSync === "offline" ||
        hasPendingSync(currentSync) ||
        isSaving()
      )
        return failure("preflight");
      if (await hasBlockingSyncState(deps, owner)) return failure("preflight");

      if (deps.beginReset && !deps.beginReset(owner)) return failure("lock_unavailable");

      try {
        tombstone = parseTombstone(await deps.wipeRemote(userId)) ?? undefined;
      } catch {
        // A timed-out request may have committed remotely; callers must not
        // claim the old save was preserved and should reload/reconcile.
        return failure("remote_unconfirmed");
      }
      if (!tombstone) return failure("remote_unconfirmed");
      if (!deps.persistTombstone) return failure("tombstone_persist_failed", tombstone);
      try {
        if (!(await deps.persistTombstone(owner, tombstone)))
          return failure("tombstone_persist_failed", tombstone);
      } catch {
        return failure("tombstone_persist_failed", tombstone);
      }
      if (!isCurrentOwner(owner)) return failure("identity_changed", tombstone);
    } else if (owner !== null) {
      return failure("identity_changed");
    } else if (deps.beginReset && !deps.beginReset(owner)) {
      return failure("lock_unavailable");
    }

    let localCleared: boolean;
    try {
      // A reset is successful only when storage confirms every IndexedDB key
      // is gone and the mirror was removed afterwards.
      localCleared = await deps.clearLocal(owner);
    } catch {
      return failure("local_cleanup_failed", tombstone);
    }
    if (!localCleared) return failure("local_cleanup_failed", tombstone);
    if (!isCurrentOwner(owner)) return failure("identity_changed", tombstone);

    return tombstone ? { ok: true, tombstone } : { ok: true };
  };

  // Guest saves and resets use the same named cross-tab lock. Without it, an
  // in-flight save could finish after cleanup and resurrect the career.
  if (!deps.withCrossTabLock) return failure("lock_unavailable");
  try {
    const coordinated = await deps.withCrossTabLock(owner, reset);
    if (!coordinated.acquired) return failure("lock_unavailable");
    return coordinated.value ?? failure("preflight");
  } catch {
    return failure("preflight");
  }
}
