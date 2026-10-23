import type { CareerState } from "@/game/types";
import {
  backupCareerBeforeMigration,
  clearOutbox,
  loadLocalCareer,
  localOwnerScope,
  queueSync,
  readOutbox,
  saveLocalCareer,
  type LocalOwnerId,
} from "./store";

interface CareerSyncOptions {
  assertOwner: () => Promise<void>;
  upload: (state: CareerState) => Promise<unknown>;
  prepare?: (state: CareerState) => CareerState | Promise<CareerState>;
}
export interface CareerSyncResult {
  state: CareerState | null;
  synced: boolean;
}
const uploads = new Map<string, Promise<void>>();
const same = (left: CareerState | null, right: CareerState | null) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Every hook instance shares the same owner upload lane in this browser context. */
export async function flushCareerSync(
  owner: LocalOwnerId,
  options: CareerSyncOptions,
): Promise<CareerSyncResult> {
  const scope = localOwnerScope(owner);
  const previous = uploads.get(scope) ?? Promise.resolve();
  const operation = previous
    .catch(() => {})
    .then(async (): Promise<CareerSyncResult> => {
      await options.assertOwner();
      for (let attempt = 0; attempt < 4; attempt++) {
        const local = await loadLocalCareer(owner);
        let entry = await readOutbox(owner);
        if (!entry) return { state: local, synced: true };
        // Durable local progress is authoritative; a transport queue can be stale.
        if (local && !same(local, entry.state)) {
          await queueSync(local, owner);
          entry = await readOutbox(owner);
        }
        if (!entry) throw new Error("A fila de sincronização não pôde ser confirmada.");
        const latest = await loadLocalCareer(owner);
        if (latest && !same(latest, entry.state)) continue;
        const prepared = options.prepare ? await options.prepare(entry.state) : entry.state;
        if (!same(prepared, entry.state)) {
          await backupCareerBeforeMigration(entry.state, owner);
          const now = await loadLocalCareer(owner);
          if (now && !same(now, entry.state)) continue;
          await saveLocalCareer(prepared, "Correção antes da sincronização", owner);
          await queueSync(prepared, owner);
          continue;
        }
        await options.assertOwner();
        await options.upload(prepared);
        await options.assertOwner();
        const acknowledged = await clearOutbox(owner, entry.state, entry);
        const remaining = await readOutbox(owner);
        const current = await loadLocalCareer(owner);
        if (!remaining && current && !same(current, prepared)) {
          await queueSync(current, owner);
          return { state: current, synced: false };
        }
        return { state: current ?? prepared, synced: acknowledged && !remaining };
      }
      return { state: await loadLocalCareer(owner), synced: false };
    });
  const settled = operation.then(
    () => {},
    () => {},
  );
  uploads.set(scope, settled);
  try {
    return await operation;
  } finally {
    if (uploads.get(scope) === settled) uploads.delete(scope);
  }
}
