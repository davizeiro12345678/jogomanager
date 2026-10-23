import { createStore, del, get, keys, promisifyRequest } from "idb-keyval";
import type { Replay } from "./replay";
import { decodeReplay, encodeStoredReplay, type StoredReplayV3 } from "./replay-codec";
const REPLAY_V3_KEY = "manager3d.replays.v3";

export const REPLAY_CATALOG = "manager3d.replays.catalog.v1";
export type ReplayOwner = string | null;
const ownerPrefix = (owner: ReplayOwner) =>
  `manager3d.replays.owner.v1:user:${encodeURIComponent(owner!)}:`;
const catalogKey = (owner: ReplayOwner) =>
  owner === null ? REPLAY_CATALOG : `${ownerPrefix(owner)}catalog`;
export const replayEntryKey = (id: string, owner: ReplayOwner = null) =>
  owner === null
    ? `manager3d.replay.entry.v2:${id}`
    : `${ownerPrefix(owner)}entry:${encodeURIComponent(id)}`;
export type ReplaySummary = Pick<Replay, "id" | "createdAt" | "title" | "score"> & {
  frameCount: number;
};
const summary = (r: Replay | StoredReplayV3): ReplaySummary => ({
  id: r.id,
  createdAt: r.createdAt,
  title: r.title,
  score: r.score,
  frameCount: Array.isArray(r.frames) ? r.frames.length : r.frames.timesMs.length,
});
const replayStoreTransaction = createStore("keyval-store", "keyval");

/** Additive migration: retain the original archive as a recovery copy. A published
 * catalog is authoritative, so deleted entries cannot return from that copy. */
async function catalog(owner: ReplayOwner): Promise<ReplaySummary[]> {
  const key = catalogKey(owner);
  const existing = await get<ReplaySummary[]>(key);
  if (existing) return existing;
  // An account never adopts the previous visitor's or another account's archive.
  if (owner !== null) return [];
  const originals = (await get<Replay[]>("manager3d.replays.v2")) ?? [];
  const records = new Map<string, Replay | StoredReplayV3>(originals.map((r) => [r.id, r]));
  const packed = (await get<StoredReplayV3[]>(REPLAY_V3_KEY)) ?? [];
  for (const record of packed) {
    try {
      decodeReplay(record);
      records.set(record.id, record);
    } catch (error) {
      if (!records.has(record.id)) throw error;
    }
  }
  const summaries = [...records.values()].map(summary).sort((a, b) => b.createdAt - a.createdAt);
  await replayStoreTransaction("readwrite", (store) => {
    const request = store.get(REPLAY_CATALOG);
    request.onsuccess = () => {
      if (request.result !== undefined) return;
      for (const r of records.values()) store.put(r, replayEntryKey(r.id));
      store.put(summaries, REPLAY_CATALOG);
    };
    return promisifyRequest(store.transaction);
  });
  return (await get<ReplaySummary[]>(REPLAY_CATALOG)) ?? [];
}

export async function listReplaySummaries(owner: ReplayOwner = null): Promise<ReplaySummary[]> {
  return typeof window === "undefined" ? [] : catalog(owner);
}

export async function loadReplay(
  id: string,
  owner: ReplayOwner = null,
): Promise<Replay | undefined> {
  if (typeof window === "undefined") return undefined;
  // Only one record is cloned into the gallery process on selection.
  if (!(await catalog(owner)).some((r) => r.id === id)) return undefined;
  const stored = await get<Replay | StoredReplayV3>(replayEntryKey(id, owner));
  return stored ? decodeReplay(stored) : undefined;
}

export async function storeReplayEntry(replay: Replay, owner: ReplayOwner = null): Promise<void> {
  if (typeof window === "undefined") return;
  decodeReplay(replay);
  const stored = encodeStoredReplay(replay);
  await catalog(owner);
  await replayStoreTransaction("readwrite", (store) => {
    const request = store.get(catalogKey(owner));
    request.onsuccess = () => {
      const current = (request.result ?? []) as ReplaySummary[];
      const next = [summary(replay), ...current.filter((r) => r.id !== replay.id)].slice(0, 20);
      for (const entry of current)
        if (!next.some((r) => r.id === entry.id)) store.delete(replayEntryKey(entry.id, owner));
      store.put(stored, replayEntryKey(replay.id, owner));
      store.put(next, catalogKey(owner));
    };
    return promisifyRequest(store.transaction);
  });
}

export async function removeReplayEntry(id: string, owner: ReplayOwner = null): Promise<void> {
  if (typeof window === "undefined") return;
  await catalog(owner);
  await replayStoreTransaction("readwrite", (store) => {
    const request = store.get(catalogKey(owner));
    request.onsuccess = () => {
      store.put(
        ((request.result ?? []) as ReplaySummary[]).filter((r) => r.id !== id),
        catalogKey(owner),
      );
      store.delete(replayEntryKey(id, owner));
    };
    return promisifyRequest(store.transaction);
  });
}

/** Read the local replay archive for the visitor's explicit data export. */
export async function exportReplayArchive(
  owner: ReplayOwner = null,
): Promise<Record<string, unknown>> {
  if (typeof window === "undefined") return {};
  const replayKeys = (await keys()).filter(
    (key): key is string =>
      typeof key === "string" &&
      (owner !== null
        ? key.startsWith(ownerPrefix(owner))
        : key === REPLAY_CATALOG ||
          key === "manager3d.replays.v2" ||
          key === REPLAY_V3_KEY ||
          key.startsWith("manager3d.replay.entry.v2:") ||
          key.startsWith("manager3d.replay.v3:")),
  );
  const entries = await Promise.all(
    replayKeys.map(async (key) => [key, await get<unknown>(key)] as const),
  );
  return Object.fromEntries(entries);
}

/** Delete every current and recovery copy of the local replay archive. */
export async function clearReplayArchive(owner: ReplayOwner = null): Promise<boolean> {
  if (typeof window === "undefined") return true;
  try {
    const replayKeys = (await keys()).filter(
      (key): key is string =>
        typeof key === "string" &&
        (owner !== null
          ? key.startsWith(ownerPrefix(owner))
          : key === REPLAY_CATALOG ||
            key === "manager3d.replays.v2" ||
            key === REPLAY_V3_KEY ||
            key.startsWith("manager3d.replay.entry.v2:") ||
            key.startsWith("manager3d.replay.v3:")),
    );
    await Promise.all(replayKeys.map((key) => del(key)));
    return true;
  } catch {
    return false;
  }
}
