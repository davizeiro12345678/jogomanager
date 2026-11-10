/**
 * Persistência offline de carreira.
 *
 * O aparelho pode ser compartilhado. Por isso cada conta e o modo visitante
 * possuem compartimentos independentes no IndexedDB e no espelho local. Saves
 * antigos, que não tinham dono ou geração, nunca são enviados silenciosamente.
 */
import { clear, del, delMany, get, getMany, set, setMany, update } from "idb-keyval";

import type { CareerState } from "@/game/types";

/** Chave de compatibilidade de saves locais sem dono (visitante). */
export const LEGACY_KEY = "manager3d.career.v1";
const LEGACY_IDB = {
  career: "career.state",
  savedAt: "career.savedAt",
  snapshots: "career.snapshots",
  outbox: "career.outbox",
  generation: "career.generation",
  tombstone: "career.tombstone",
  syncBlock: "career.syncBlock",
} as const;
const LOCAL_PREFIX = "manager3d.career.v2.";
const IDB_PREFIX = "career.v2.";
const CAREER_LOCK_PREFIX = "manager3d.career.lock.";
const MAX_SNAPSHOTS = 10;

export type LocalOwnerId = string | null;

export interface Snapshot {
  at: number;
  label: string;
  state: CareerState;
}

/** The optional fields model entries written by pre-generation clients. */
export interface OutboxEntry {
  at: number;
  state: CareerState;
  generation?: number;
  /** Present on new entries; timestamps alone can collide between rapid saves. */
  revision?: string;
}

export interface LocalCareerTombstone {
  generation: number;
  deletedAt: string;
}

export type LocalCareerSyncBlockReason =
  "deleted" | "conflict" | "unknown_generation" | "legacy_outbox" | "pending_save" | "unknown";

export interface LocalCareerSyncBlock {
  reason: LocalCareerSyncBlockReason;
  generation: number | null;
  blockedAt: string;
  deletedAt?: string;
}

export interface CareerOperationOptions {
  /** The caller already owns the named cross-tab lock. */
  lockHeld?: boolean;
  /** The remote generation observed by this local compartment. */
  generation?: number;
  /** Permit writing while a durable pending-save barrier protects the compartment. */
  allowPendingBarrier?: boolean;
  /** Epoch of the career instance that originated this operation. */
  expectedEpoch?: number;
}

export interface CareerLockResult<T> {
  /** False means this browser cannot provide cross-tab coordination. */
  acquired: boolean;
  value?: T;
  /** The lock was reached, but a reset advanced the compartment version first. */
  stale?: boolean;
}

const isBrowser = () => typeof window !== "undefined";

/** Keeps arbitrary auth subject strings inside a single storage-key segment. */
export function localOwnerScope(owner: LocalOwnerId | undefined = null) {
  return owner && owner.trim() ? `account-${encodeURIComponent(owner)}` : "guest";
}

function browserLocks(): LockManager | null {
  if (typeof navigator === "undefined") return null;
  const locks = navigator.locks;
  return locks && typeof locks.request === "function" ? locks : null;
}

function careerLockName(owner: LocalOwnerId | undefined) {
  return `${CAREER_LOCK_PREFIX}${localOwnerScope(owner)}`;
}

/**
 * True only when the platform can coordinate independent tabs. A same-tab
 * fallback is deliberately not reported as acquired: authenticated reset must
 * fail closed when a browser cannot provide a real cross-tab lock.
 */
export function hasCareerCrossTabLock() {
  return browserLocks() !== null;
}

/** Serialize every operation that can touch a career compartment across tabs. */
export async function withCareerLock<T>(
  owner: LocalOwnerId | undefined,
  callback: () => Promise<T> | T,
  expectedEpoch?: number,
): Promise<CareerLockResult<T>> {
  const locks = browserLocks();
  if (!locks) return { acquired: false };
  const capturedEpoch = expectedEpoch ?? readCareerEpoch(owner);
  if (capturedEpoch === null || !Number.isSafeInteger(capturedEpoch) || capturedEpoch < 0)
    return { acquired: false };

  let acquired = false;
  let stale = false;
  let value: T | undefined;
  try {
    await locks.request(careerLockName(owner), { mode: "exclusive" }, async () => {
      const currentEpoch = readCareerEpoch(owner);
      if (currentEpoch === null || currentEpoch !== capturedEpoch) {
        stale = true;
        return;
      }
      acquired = true;
      value = await callback();
    });
  } catch (error) {
    if (acquired) throw error;
    return { acquired: false };
  }
  if (stale) return { acquired: true, stale: true };
  return value === undefined ? { acquired: true } : { acquired: true, value };
}

async function runWithOptionalCareerLock<T>(
  owner: LocalOwnerId | undefined,
  operation: () => Promise<T>,
  staleValue: T,
  options?: CareerOperationOptions,
): Promise<T> {
  if (options?.expectedEpoch !== undefined && readCareerEpoch(owner) !== options.expectedEpoch)
    return staleValue;
  if (options?.lockHeld) return operation();
  const coordinated = await withCareerLock(owner, operation, options?.expectedEpoch);
  if (coordinated.stale) return staleValue;
  return coordinated.acquired ? (coordinated.value as T) : operation();
}

function idbKey(owner: LocalOwnerId | undefined, name: keyof typeof LEGACY_IDB) {
  return `${IDB_PREFIX}${localOwnerScope(owner)}.${name}`;
}

function localKey(owner: LocalOwnerId | undefined) {
  return `${LOCAL_PREFIX}${localOwnerScope(owner)}`;
}

function localEpochKey(owner: LocalOwnerId | undefined) {
  return `${localKey(owner)}.epoch`;
}

function localGenerationKey(owner: LocalOwnerId | undefined) {
  return `${localKey(owner)}.generation`;
}

function localTombstoneKey(owner: LocalOwnerId | undefined) {
  return `${localKey(owner)}.tombstone`;
}

function localSyncBlockKey(owner: LocalOwnerId | undefined) {
  return `${localKey(owner)}.sync-block`;
}

/** Returns null when localStorage cannot be read, not when the epoch is zero. */
export function readCareerEpoch(owner: LocalOwnerId | undefined = null): number | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(localEpochKey(owner));
    if (raw === null) return 0;
    const epoch = Number(raw);
    return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null;
  } catch {
    return null;
  }
}

/** Advances the local reset barrier while the named career lock is held. */
export function markCareerReset(owner: LocalOwnerId | undefined = null) {
  const current = readCareerEpoch(owner);
  if (current === null || !isBrowser()) return false;
  try {
    const next = current + 1;
    window.localStorage.setItem(localEpochKey(owner), String(next));
    return readCareerEpoch(owner) === next;
  } catch {
    return false;
  }
}

function isGuest(owner: LocalOwnerId | undefined) {
  return !owner || !owner.trim();
}

function localMirrorKeys(owner: LocalOwnerId | undefined) {
  return isGuest(owner) ? [localKey(owner), LEGACY_KEY] : [localKey(owner)];
}

function localMetadataKeys(owner: LocalOwnerId | undefined) {
  return [localGenerationKey(owner), localTombstoneKey(owner), localSyncBlockKey(owner)];
}

function idbCareerKeys(owner: LocalOwnerId | undefined) {
  const keys: IDBValidKey[] = [
    idbKey(owner, "career"),
    idbKey(owner, "savedAt"),
    idbKey(owner, "snapshots"),
    idbKey(owner, "outbox"),
    idbKey(owner, "generation"),
    idbKey(owner, "tombstone"),
    idbKey(owner, "syncBlock"),
  ];
  if (isGuest(owner)) {
    keys.push(
      LEGACY_IDB.career,
      LEGACY_IDB.savedAt,
      LEGACY_IDB.snapshots,
      LEGACY_IDB.outbox,
      LEGACY_IDB.generation,
      LEGACY_IDB.tombstone,
      LEGACY_IDB.syncBlock,
    );
  }
  return keys;
}

/* ------------------------------------------------------------------ *
 * Espelho síncrono (localStorage)
 * ------------------------------------------------------------------ */

export function readLocalCareer(owner: LocalOwnerId | undefined = null): CareerState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(localKey(owner));
    if (raw) {
      const stored: unknown = JSON.parse(raw);
      if (isCareerRecord(stored)) return stored;
    }
    if (isGuest(owner)) {
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      const stored: unknown = legacy ? JSON.parse(legacy) : null;
      return isCareerRecord(stored) ? stored : null;
    }
  } catch {
    /* Corrupt local data is ignored instead of blocking the game. */
  }
  return null;
}

/** Local persistence is untrusted; complete save validation remains server-side. */
function isCareerRecord(value: unknown): value is CareerState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function parseGeneration(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : null;
}

function parseLocalTombstone(value: unknown): LocalCareerTombstone | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LocalCareerTombstone>;
  const generation = parseGeneration(candidate.generation);
  return generation !== null &&
    typeof candidate.deletedAt === "string" &&
    candidate.deletedAt.length > 0
    ? { generation, deletedAt: candidate.deletedAt }
    : null;
}

function unknownSyncBlock(): LocalCareerSyncBlock {
  return { reason: "unknown", generation: null, blockedAt: "unknown-block" };
}

function validateLocalSyncBlock(value: unknown): LocalCareerSyncBlock | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LocalCareerSyncBlock>;
  const reasons: LocalCareerSyncBlockReason[] = [
    "deleted",
    "conflict",
    "unknown_generation",
    "legacy_outbox",
    "pending_save",
  ];
  if (!reasons.includes(candidate.reason as LocalCareerSyncBlockReason)) return null;
  if (typeof candidate.blockedAt !== "string" || !candidate.blockedAt) return null;
  const generation = candidate.generation === null ? null : parseGeneration(candidate.generation);
  if (candidate.generation !== null && generation === null) return null;
  return {
    reason: candidate.reason as LocalCareerSyncBlockReason,
    generation,
    blockedAt: candidate.blockedAt,
    ...(typeof candidate.deletedAt === "string" ? { deletedAt: candidate.deletedAt } : {}),
  };
}

function parseLocalSyncBlock(value: unknown): LocalCareerSyncBlock | null {
  if (value === null || value === undefined) return null;
  return validateLocalSyncBlock(value) ?? unknownSyncBlock();
}

export async function readLocalCareerGeneration(
  owner: LocalOwnerId | undefined = null,
): Promise<number | null> {
  if (!isBrowser()) return null;
  try {
    const generation = parseGeneration(await get<number>(idbKey(owner, "generation")));
    if (generation !== null) return generation;
  } catch {
    /* Fall through to the synchronous mirror. */
  }
  try {
    return parseGeneration(Number(window.localStorage.getItem(localGenerationKey(owner))));
  } catch {
    return null;
  }
}

export async function setLocalCareerGeneration(
  generation: number,
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    async () => {
      const epochIsCurrent = () =>
        options?.expectedEpoch === undefined || readCareerEpoch(owner) === options.expectedEpoch;
      if (!isBrowser() || parseGeneration(generation) === null || !epochIsCurrent()) return false;
      let idbSaved = false;
      try {
        await set(idbKey(owner, "generation"), generation);
        idbSaved =
          epochIsCurrent() &&
          parseGeneration(await get<number>(idbKey(owner, "generation"))) === generation;
      } catch {
        /* The mirror may still be available in private browsing. */
      }
      if (!epochIsCurrent()) return false;
      let mirrorSaved = false;
      try {
        const key = localGenerationKey(owner);
        window.localStorage.setItem(key, String(generation));
        mirrorSaved =
          epochIsCurrent() &&
          parseGeneration(Number(window.localStorage.getItem(key))) === generation;
      } catch {
        /* Keep any durable IndexedDB metadata. */
      }
      return epochIsCurrent() && (idbSaved || mirrorSaved);
    },
    false,
    options,
  );
}

/** Reads the local deletion barrier without touching the recovery snapshot. */
export async function readLocalCareerTombstone(
  owner: LocalOwnerId | undefined = null,
): Promise<LocalCareerTombstone | null> {
  if (!isBrowser()) return null;
  try {
    const keys = [idbKey(owner, "tombstone"), ...(isGuest(owner) ? [LEGACY_IDB.tombstone] : [])];
    const values = await getMany(keys);
    for (const value of values) {
      const stored = parseLocalTombstone(value);
      if (stored) return stored;
    }
  } catch {
    /* Fall through to the synchronous mirror. */
  }
  try {
    return parseLocalTombstone(
      JSON.parse(window.localStorage.getItem(localTombstoneKey(owner)) ?? "null"),
    );
  } catch {
    return null;
  }
}

export async function readLocalCareerSyncBlock(
  owner: LocalOwnerId | undefined = null,
): Promise<LocalCareerSyncBlock | null> {
  if (!isBrowser()) return null;
  let idbUnreadable = false;
  try {
    const stored = parseLocalSyncBlock(await get<LocalCareerSyncBlock>(idbKey(owner, "syncBlock")));
    if (stored) return stored;
  } catch {
    idbUnreadable = true;
  }
  try {
    const raw = window.localStorage.getItem(localSyncBlockKey(owner));
    if (raw !== null) return parseLocalSyncBlock(JSON.parse(raw)) ?? unknownSyncBlock();
    return idbUnreadable ? unknownSyncBlock() : null;
  } catch {
    // An unreadable block is not proof that the compartment is safe to mutate
    // or reset. Use a fail-closed in-memory result for this call.
    return unknownSyncBlock();
  }
}

export async function markLocalCareerSyncBlock(
  block: LocalCareerSyncBlock,
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    async () => {
      const epochIsCurrent = () =>
        options?.expectedEpoch === undefined || readCareerEpoch(owner) === options.expectedEpoch;
      if (!isBrowser() || !validateLocalSyncBlock(block) || !epochIsCurrent()) return false;
      let idbSaved = false;
      try {
        await set(idbKey(owner, "syncBlock"), block);
        idbSaved =
          epochIsCurrent() &&
          parseLocalSyncBlock(await get<LocalCareerSyncBlock>(idbKey(owner, "syncBlock"))) !== null;
      } catch {
        /* The mirror may still be available in private browsing. */
      }
      if (!epochIsCurrent()) return false;
      let mirrorSaved = false;
      try {
        const key = localSyncBlockKey(owner);
        window.localStorage.setItem(key, JSON.stringify(block));
        mirrorSaved =
          epochIsCurrent() &&
          parseLocalSyncBlock(JSON.parse(window.localStorage.getItem(key) ?? "null")) !== null;
      } catch {
        /* Keep any durable IndexedDB marker. */
      }
      return epochIsCurrent() && (idbSaved || mirrorSaved);
    },
    false,
    options,
  );
}

export async function clearLocalCareerSyncBlock(
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    async () => {
      const epochIsCurrent = () =>
        options?.expectedEpoch === undefined || readCareerEpoch(owner) === options.expectedEpoch;
      if (!isBrowser() || !epochIsCurrent()) return false;
      try {
        await del(idbKey(owner, "syncBlock"));
        if (!epochIsCurrent()) return false;
        if ((await get<LocalCareerSyncBlock>(idbKey(owner, "syncBlock"))) !== undefined)
          return false;
      } catch {
        return false;
      }
      if (!epochIsCurrent()) return false;
      try {
        const key = localSyncBlockKey(owner);
        window.localStorage.removeItem(key);
        return epochIsCurrent() && window.localStorage.getItem(key) === null;
      } catch {
        return false;
      }
    },
    false,
    options,
  );
}

/** Persists the deletion barrier while intentionally retaining recovery data. */
export async function markLocalCareerTombstone(
  tombstone: LocalCareerTombstone,
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    async () => {
      const epochIsCurrent = () =>
        options?.expectedEpoch === undefined || readCareerEpoch(owner) === options.expectedEpoch;
      if (!isBrowser() || !parseLocalTombstone(tombstone) || !epochIsCurrent()) return false;
      let idbSaved = false;
      try {
        await set(idbKey(owner, "tombstone"), tombstone);
        idbSaved =
          epochIsCurrent() &&
          parseLocalTombstone(await get<LocalCareerTombstone>(idbKey(owner, "tombstone"))) !== null;
      } catch {
        /* The mirror may still be available in private browsing. */
      }
      if (!epochIsCurrent()) return false;
      let mirrorSaved = false;
      try {
        const key = localTombstoneKey(owner);
        window.localStorage.setItem(key, JSON.stringify(tombstone));
        mirrorSaved =
          epochIsCurrent() &&
          parseLocalTombstone(JSON.parse(window.localStorage.getItem(key) ?? "null")) !== null;
      } catch {
        /* Keep any durable IDB marker. */
      }
      if (!epochIsCurrent()) return false;
      await markLocalCareerSyncBlock(
        {
          reason: "deleted",
          generation: tombstone.generation,
          deletedAt: tombstone.deletedAt,
          blockedAt: tombstone.deletedAt,
        },
        owner,
        { ...options, lockHeld: true },
      );
      return epochIsCurrent() && (idbSaved || mirrorSaved);
    },
    false,
    options,
  );
}

/** Removes only the deletion barrier after an explicit new career is confirmed. */
export async function clearLocalCareerTombstone(
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    async () => {
      const epochIsCurrent = () =>
        options?.expectedEpoch === undefined || readCareerEpoch(owner) === options.expectedEpoch;
      if (!isBrowser() || !epochIsCurrent()) return false;
      try {
        await del(idbKey(owner, "tombstone"));
        if (isGuest(owner)) await del(LEGACY_IDB.tombstone);
        if (!epochIsCurrent()) return false;
        if ((await get<LocalCareerTombstone>(idbKey(owner, "tombstone"))) !== undefined)
          return false;
      } catch {
        return false;
      }
      if (!epochIsCurrent()) return false;
      try {
        const key = localTombstoneKey(owner);
        window.localStorage.removeItem(key);
        const block = await readLocalCareerSyncBlock(owner);
        if (
          block?.reason === "deleted" &&
          !(await clearLocalCareerSyncBlock(owner, { ...options, lockHeld: true }))
        )
          return false;
        return (
          epochIsCurrent() &&
          window.localStorage.getItem(key) === null &&
          (await readLocalCareerSyncBlock(owner))?.reason !== "deleted"
        );
      } catch {
        return false;
      }
    },
    false,
    options,
  );
}

function mirror(state: CareerState | null, owner: LocalOwnerId | undefined = null) {
  if (!isBrowser()) return false;
  try {
    const key = localKey(owner);
    if (state) window.localStorage.setItem(key, JSON.stringify(state));
    else window.localStorage.removeItem(key);
    if (isGuest(owner)) {
      if (state) window.localStorage.setItem(LEGACY_KEY, JSON.stringify(state));
      else window.localStorage.removeItem(LEGACY_KEY);
    }
    const expected = state ? JSON.stringify(state) : null;
    return (
      window.localStorage.getItem(localKey(owner)) === expected &&
      (!isGuest(owner) || window.localStorage.getItem(LEGACY_KEY) === expected)
    );
  } catch {
    return false;
  }
}

function removeMirrorAndVerify(owner: LocalOwnerId | undefined) {
  if (!isBrowser()) return false;
  try {
    const keys = [...localMirrorKeys(owner), ...localMetadataKeys(owner)];
    for (const key of keys) window.localStorage.removeItem(key);
    return keys.every((key) => window.localStorage.getItem(key) === null);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ *
 * Carreira
 * ------------------------------------------------------------------ */

export async function loadLocalCareer(
  owner: LocalOwnerId | undefined = null,
): Promise<CareerState | null> {
  if (!isBrowser()) return null;
  const migrationEpoch = readCareerEpoch(owner);
  try {
    const stored = await get<CareerState>(idbKey(owner, "career"));
    if (isCareerRecord(stored)) return stored;
  } catch {
    /* IndexedDB indisponível — usa o espelho */
  }

  if (!isGuest(owner)) return readLocalCareer(owner);
  try {
    const legacy = await get<CareerState>(LEGACY_IDB.career);
    if (isCareerRecord(legacy)) {
      if (migrationEpoch !== null)
        await saveLocalCareer(legacy, "migração", null, { expectedEpoch: migrationEpoch });
      return legacy;
    }
  } catch {
    /* fallback below */
  }
  const legacy = readLocalCareer(null);
  if (legacy) {
    if (migrationEpoch !== null)
      await saveLocalCareer(legacy, "migração", null, { expectedEpoch: migrationEpoch });
    return legacy;
  }
  return null;
}

export async function localSavedAt(owner: LocalOwnerId | undefined = null): Promise<number> {
  if (!isBrowser()) return 0;
  try {
    return (await get<number>(idbKey(owner, "savedAt"))) ?? 0;
  } catch {
    return 0;
  }
}

function samePersistedValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (actual instanceof Date || expected instanceof Date)
    return (
      actual instanceof Date && expected instanceof Date && actual.getTime() === expected.getTime()
    );
  if (Array.isArray(actual) || Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) => samePersistedValue(value, expected[index]))
    );
  if (
    actual === null ||
    expected === null ||
    typeof actual !== "object" ||
    typeof expected !== "object"
  )
    return false;
  const actualRecord = actual as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  const actualKeys = Object.keys(actualRecord).sort();
  const expectedKeys = Object.keys(expectedRecord).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, index) =>
        key === expectedKeys[index] && samePersistedValue(actualRecord[key], expectedRecord[key]),
    )
  );
}

async function saveLocalCareerLocal(
  state: CareerState,
  label: string,
  owner: LocalOwnerId | undefined,
  generation?: number,
  allowPendingBarrier = false,
  expectedEpoch?: number,
): Promise<boolean> {
  if (expectedEpoch !== undefined && readCareerEpoch(owner) !== expectedEpoch) return false;
  const block = await readLocalCareerSyncBlock(owner);
  if (
    !isBrowser() ||
    (block &&
      !(allowPendingBarrier && (block.reason === "pending_save" || block.reason === "deleted")))
  )
    return false;
  if (generation !== undefined && parseGeneration(generation) === null) return false;
  if (expectedEpoch !== undefined && readCareerEpoch(owner) !== expectedEpoch) return false;
  let idbSaved = false;
  try {
    const now = Date.now();
    const list = (await get<Snapshot[]>(idbKey(owner, "snapshots"))) ?? [];
    const next = [{ at: now, label, state }, ...list].slice(0, MAX_SNAPSHOTS);
    const entries: [IDBValidKey, unknown][] = [
      [idbKey(owner, "career"), state],
      [idbKey(owner, "savedAt"), now],
      [idbKey(owner, "snapshots"), next],
    ];
    if (generation !== undefined) entries.push([idbKey(owner, "generation"), generation]);
    await setMany(entries);
    const persisted = await get<CareerState>(idbKey(owner, "career"));
    idbSaved = samePersistedValue(persisted, state);
  } catch {
    // The mirror remains the last-resort local save when IDB is unavailable.
  }
  if (expectedEpoch !== undefined && readCareerEpoch(owner) !== expectedEpoch) return false;
  const mirrorSaved = mirror(state, owner);
  const generationSaved =
    generation === undefined ||
    (await setLocalCareerGeneration(generation, owner, {
      lockHeld: true,
      ...(expectedEpoch !== undefined ? { expectedEpoch } : {}),
    }));
  return (
    (idbSaved || mirrorSaved) &&
    generationSaved &&
    (expectedEpoch === undefined || readCareerEpoch(owner) === expectedEpoch)
  );
}

export async function saveLocalCareer(
  state: CareerState,
  label = "auto",
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    () =>
      saveLocalCareerLocal(
        state,
        label,
        owner,
        options?.generation,
        options?.allowPendingBarrier,
        options?.expectedEpoch,
      ),
    false,
    options,
  );
}

export async function listSnapshots(owner: LocalOwnerId | undefined = null): Promise<Snapshot[]> {
  if (!isBrowser()) return [];
  try {
    return (await get<Snapshot[]>(idbKey(owner, "snapshots"))) ?? [];
  } catch {
    return [];
  }
}

/** Remove the complete compartment only after every deletion is confirmed. */
export async function clearLocalCareer(
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    async () => {
      if (
        !isBrowser() ||
        (options?.expectedEpoch !== undefined && readCareerEpoch(owner) !== options.expectedEpoch)
      )
        return false;
      const keys = idbCareerKeys(owner);
      try {
        await delMany(keys);
        if (
          options?.expectedEpoch !== undefined &&
          readCareerEpoch(owner) !== options.expectedEpoch
        )
          return false;
        const remaining = await getMany(keys);
        if (remaining.some((value) => value !== undefined && value !== null)) return false;
        if (
          options?.expectedEpoch !== undefined &&
          readCareerEpoch(owner) !== options.expectedEpoch
        )
          return false;
        return removeMirrorAndVerify(owner);
      } catch {
        return false;
      }
    },
    false,
    options,
  );
}

/** Explicit device-wide reset used only by the existing destructive settings action. */
export async function wipeEverything() {
  if (isBrowser()) {
    try {
      const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index),
      );
      for (const key of keys) {
        if (key === LEGACY_KEY || key?.startsWith(LOCAL_PREFIX))
          window.localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    await clear();
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Fila de envio
 * ------------------------------------------------------------------ */

export function isVersionedOutboxEntry(
  entry: OutboxEntry | null,
): entry is OutboxEntry & { generation: number; revision: string } {
  return (
    isOutboxEntry(entry) &&
    parseGeneration(entry.generation) !== null &&
    typeof entry.revision === "string" &&
    entry.revision.length > 0
  );
}

function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<OutboxEntry>;
  return (
    typeof entry.at === "number" &&
    Number.isFinite(entry.at) &&
    entry.at >= 0 &&
    isCareerRecord(entry.state) &&
    (entry.generation === undefined || parseGeneration(entry.generation) !== null) &&
    (entry.revision === undefined ||
      (typeof entry.revision === "string" &&
        entry.revision.length > 0 &&
        entry.revision.length <= 128))
  );
}

async function queueSyncLocal(
  state: CareerState,
  owner: LocalOwnerId | undefined,
  generation: number | undefined,
  allowPendingBarrier = false,
  expectedEpoch?: number,
): Promise<OutboxEntry | null> {
  if (expectedEpoch !== undefined && readCareerEpoch(owner) !== expectedEpoch) return null;
  const safeGeneration = parseGeneration(generation);
  if (!isBrowser() || safeGeneration === null) return null;
  const block = await readLocalCareerSyncBlock(owner);
  if (block && !(allowPendingBarrier && block.reason === "pending_save")) return null;
  if (expectedEpoch !== undefined && readCareerEpoch(owner) !== expectedEpoch) return null;
  try {
    const entry: OutboxEntry = {
      at: Date.now(),
      state,
      generation: safeGeneration,
      revision: crypto.randomUUID(),
    };
    await set(idbKey(owner, "outbox"), entry);
    if (expectedEpoch !== undefined && readCareerEpoch(owner) !== expectedEpoch) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function queueSync(
  state: CareerState,
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
): Promise<OutboxEntry | null> {
  return runWithOptionalCareerLock(
    owner,
    () =>
      queueSyncLocal(
        state,
        owner,
        options?.generation,
        options?.allowPendingBarrier,
        options?.expectedEpoch,
      ),
    null,
    options,
  );
}

export async function readOutbox(
  owner: LocalOwnerId | undefined = null,
): Promise<OutboxEntry | null> {
  if (!isBrowser()) return null;
  try {
    const stored: unknown = await get(idbKey(owner, "outbox"));
    if (stored === undefined || stored === null) return null;
    if (!isOutboxEntry(stored)) throw new TypeError("Invalid persisted career outbox");
    return stored;
  } catch (cause) {
    // An unreadable durable queue is not equivalent to an empty queue: callers
    // performing destructive operations must fail closed.
    throw new Error("Career outbox is unreadable", { cause });
  }
}

async function clearOutboxLocal(owner: LocalOwnerId | undefined) {
  if (!isBrowser()) return;
  try {
    await del(idbKey(owner, "outbox"));
  } catch {
    /* ignore */
  }
}

export async function clearOutbox(
  owner: LocalOwnerId | undefined = null,
  options?: CareerOperationOptions,
) {
  return runWithOptionalCareerLock(owner, () => clearOutboxLocal(owner), undefined, options);
}

/** A completed upload must not erase a save queued while the network was busy. */
async function acknowledgeOutboxLocal(
  uploaded: OutboxEntry | null,
  owner: LocalOwnerId,
): Promise<boolean> {
  if (!isBrowser() || !isVersionedOutboxEntry(uploaded)) return false;
  try {
    let acknowledged = false;
    await update<OutboxEntry | null>(idbKey(owner, "outbox"), (current) => {
      if (current == null) {
        acknowledged = true;
        return null;
      }
      if (isVersionedOutboxEntry(current) && current.revision === uploaded.revision) {
        acknowledged = true;
        return null;
      }
      return current;
    });
    return acknowledged;
  } catch {
    return false;
  }
}

export async function acknowledgeOutbox(
  uploaded: OutboxEntry | null,
  owner: LocalOwnerId,
  options?: CareerOperationOptions,
): Promise<boolean> {
  return runWithOptionalCareerLock(
    owner,
    () => acknowledgeOutboxLocal(uploaded, owner),
    false,
    options,
  );
}

export function isOnline() {
  if (!isBrowser()) return true;
  return navigator.onLine !== false;
}
