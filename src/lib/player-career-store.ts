import { migrateAthleteAppearance } from "@/game/player-career/appearance";
import type { PlayerCareerState } from "@/game/player-career/types";
import { localOwnerScope, type LocalOwnerId } from "@/lib/offline/store";

/** The old shared key remains readable for an unsigned visitor only. */
const LEGACY_KEY = (slot: number) => `manager3d.athlete.v1.${slot}`;
/** v2 was briefly written as a raw PlayerCareerState; keep it as a read mirror. */
const COMPAT_KEY = (slot: AthleteSlot, owner: LocalOwnerId | undefined = null) =>
  `manager3d.athlete.v2.${localOwnerScope(owner)}.${slot}`;
const ENVELOPE_KEY = (slot: AthleteSlot, owner: LocalOwnerId | undefined = null) =>
  `manager3d.athlete.envelope.v1.${localOwnerScope(owner)}.${slot}`;
const INDEX_KEY = (owner: LocalOwnerId | undefined = null) =>
  `manager3d.athlete.index.v1.${localOwnerScope(owner)}`;
const OUTBOX_KEY = (owner: LocalOwnerId | undefined = null) =>
  `manager3d.athlete.outbox.v1.${localOwnerScope(owner)}`;

export const ATHLETE_SLOTS = [1, 2, 3] as const;
export type AthleteSlot = (typeof ATHLETE_SLOTS)[number];

export const ATHLETE_ENVELOPE_VERSION = 1 as const;
export const ATHLETE_INDEX_VERSION = 1 as const;
export const ATHLETE_SYNC_QUEUE_VERSION = 1 as const;
/** One latest operation for each of the three real slots, never an unbounded log. */
export const ATHLETE_SYNC_QUEUE_LIMIT = ATHLETE_SLOTS.length;
export const ATHLETE_SYNC_MAX_ATTEMPTS = 10;
export const ATHLETE_SYNC_MAX_BACKOFF_MS = 5 * 60 * 1000;

export interface AthleteSaveEnvelope {
  version: typeof ATHLETE_ENVELOPE_VERSION;
  kind: "athlete-save";
  slot: AthleteSlot;
  revision: number;
  savedAt: number;
  state: PlayerCareerState;
}

export interface AthleteSavedIndexEntry {
  kind: "saved";
  slot: AthleteSlot;
  revision: number;
  savedAt: number;
  stateUpdatedAt: number;
}

export interface AthleteDeletedIndexEntry {
  kind: "deleted";
  slot: AthleteSlot;
  revision: number;
  deletedAt: number;
}

export type AthleteIndexEntry = AthleteSavedIndexEntry | AthleteDeletedIndexEntry;

export interface AthleteSaveIndex {
  version: typeof ATHLETE_INDEX_VERSION;
  slots: Partial<Record<AthleteSlot, AthleteIndexEntry>>;
}

export type AthleteDeleteTombstone = AthleteDeletedIndexEntry;

export type AthleteSyncOperation = "save" | "delete";

export interface AthleteSyncEntry {
  version: typeof ATHLETE_SYNC_QUEUE_VERSION;
  operationId: string;
  operation: AthleteSyncOperation;
  slot: AthleteSlot;
  revision: number;
  queuedAt: number;
  attempts: number;
  nextAttemptAt: number;
  state?: PlayerCareerState;
}

export interface AthleteSyncQueue {
  version: typeof ATHLETE_SYNC_QUEUE_VERSION;
  entries: AthleteSyncEntry[];
}

const emptyIndex = (): AthleteSaveIndex => ({ version: ATHLETE_INDEX_VERSION, slots: {} });
const emptyQueue = (): AthleteSyncQueue => ({ version: ATHLETE_SYNC_QUEUE_VERSION, entries: [] });
const isBrowser = () => typeof window !== "undefined";

export function isAthleteSlot(value: unknown): value is AthleteSlot {
  return typeof value === "number" && ATHLETE_SLOTS.includes(value as AthleteSlot);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isGuest(owner: LocalOwnerId | undefined) {
  return !owner || !owner.trim();
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getStorageValue(key: string) {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageValue(key: string, value: unknown) {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeStorageValue(key: string) {
  if (!isBrowser()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Kept pure so an old local or cloud state can be repaired before rendering. */
export function hydrateAthlete(value: unknown): PlayerCareerState | null {
  const state = value as Partial<PlayerCareerState> | null;
  if (
    !state ||
    state.version !== 1 ||
    typeof state.seed !== "string" ||
    typeof state.position !== "string" ||
    typeof state.build !== "string"
  ) {
    return null;
  }
  return migrateAthleteAppearance(state as PlayerCareerState);
}

function indexEntryFromEnvelope(envelope: AthleteSaveEnvelope): AthleteSavedIndexEntry {
  const updatedAt = envelope.state.updatedAt;
  return {
    kind: "saved",
    slot: envelope.slot,
    revision: envelope.revision,
    savedAt: envelope.savedAt,
    stateUpdatedAt: isNonNegativeInteger(updatedAt) ? updatedAt : envelope.savedAt,
  };
}

function normalizeIndexEntry(value: unknown, slot: AthleteSlot): AthleteIndexEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as {
    kind?: unknown;
    slot?: unknown;
    revision?: unknown;
    savedAt?: unknown;
    stateUpdatedAt?: unknown;
    deletedAt?: unknown;
  };
  if (entry.slot !== slot || !isPositiveInteger(entry.revision)) return null;

  if (entry.kind === "saved") {
    if (!isNonNegativeInteger(entry.savedAt) || !isNonNegativeInteger(entry.stateUpdatedAt))
      return null;
    return {
      kind: "saved",
      slot,
      revision: entry.revision,
      savedAt: entry.savedAt,
      stateUpdatedAt: entry.stateUpdatedAt,
    };
  }

  if (entry.kind === "deleted" && isNonNegativeInteger(entry.deletedAt)) {
    return { kind: "deleted", slot, revision: entry.revision, deletedAt: entry.deletedAt };
  }
  return null;
}

/** Repairs untrusted persisted indexes and drops anything outside the three slots. */
export function normalizeAthleteSaveIndex(value: unknown): AthleteSaveIndex {
  if (!value || typeof value !== "object") return emptyIndex();
  const candidate = value as { version?: unknown; slots?: unknown };
  if (
    candidate.version !== ATHLETE_INDEX_VERSION ||
    !candidate.slots ||
    typeof candidate.slots !== "object"
  ) {
    return emptyIndex();
  }

  const source = candidate.slots as Record<string, unknown>;
  const slots: Partial<Record<AthleteSlot, AthleteIndexEntry>> = {};
  for (const slot of ATHLETE_SLOTS) {
    const entry = normalizeIndexEntry(source[String(slot)], slot);
    if (entry) slots[slot] = entry;
  }
  return { version: ATHLETE_INDEX_VERSION, slots };
}

/** Applies only a newer revision. A same-revision tombstone wins a corrupt tie. */
export function applyAthleteIndexEntry(index: unknown, entry: AthleteIndexEntry): AthleteSaveIndex {
  const current = normalizeAthleteSaveIndex(index);
  const previous = current.slots[entry.slot];
  const replaces =
    !previous ||
    entry.revision > previous.revision ||
    (entry.revision === previous.revision &&
      entry.kind === "deleted" &&
      previous.kind !== "deleted");
  if (!replaces) return current;
  return { version: ATHLETE_INDEX_VERSION, slots: { ...current.slots, [entry.slot]: entry } };
}

export function createAthleteSaveEnvelope(
  state: PlayerCareerState,
  revision: number,
  savedAt: number,
): AthleteSaveEnvelope | null {
  if (!isAthleteSlot(state.slot) || !isPositiveInteger(revision) || !isNonNegativeInteger(savedAt))
    return null;
  const hydrated = hydrateAthlete(state);
  if (!hydrated) return null;
  return {
    version: ATHLETE_ENVELOPE_VERSION,
    kind: "athlete-save",
    slot: state.slot,
    revision,
    savedAt,
    state: { ...hydrated, slot: state.slot },
  };
}

function normalizeAthleteSaveEnvelope(
  value: unknown,
  expectedSlot?: AthleteSlot,
): AthleteSaveEnvelope | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as {
    version?: unknown;
    kind?: unknown;
    slot?: unknown;
    revision?: unknown;
    savedAt?: unknown;
    state?: unknown;
  };
  if (
    envelope.version !== ATHLETE_ENVELOPE_VERSION ||
    envelope.kind !== "athlete-save" ||
    !isAthleteSlot(envelope.slot) ||
    (expectedSlot !== undefined && envelope.slot !== expectedSlot) ||
    !isPositiveInteger(envelope.revision) ||
    !isNonNegativeInteger(envelope.savedAt)
  ) {
    return null;
  }
  const state = hydrateAthlete(envelope.state);
  if (!state || state.slot !== envelope.slot) return null;
  return {
    version: ATHLETE_ENVELOPE_VERSION,
    kind: "athlete-save",
    slot: envelope.slot,
    revision: envelope.revision,
    savedAt: envelope.savedAt,
    state,
  };
}

/**
 * Converts either legacy raw localStorage value into the first durable envelope.
 * The slot comes from the storage key, not from data that can have been edited.
 */
export function migrateLegacyAthleteSave(
  value: unknown,
  slot: AthleteSlot,
  savedAt: number,
  index: unknown = emptyIndex(),
): AthleteSaveEnvelope | null {
  if (!isNonNegativeInteger(savedAt)) return null;
  const previous = normalizeAthleteSaveIndex(index).slots[slot];
  if (previous?.kind === "deleted") return null;
  const hydrated = hydrateAthlete(value);
  if (!hydrated) return null;
  return createAthleteSaveEnvelope({ ...hydrated, slot }, (previous?.revision ?? 0) + 1, savedAt);
}

function readIndex(owner: LocalOwnerId | undefined) {
  return normalizeAthleteSaveIndex(parseJson(getStorageValue(INDEX_KEY(owner))));
}

function writeIndex(index: AthleteSaveIndex, owner: LocalOwnerId | undefined) {
  return setStorageValue(INDEX_KEY(owner), normalizeAthleteSaveIndex(index));
}

function persistEnvelope(
  envelope: AthleteSaveEnvelope,
  index: AthleteSaveIndex,
  owner: LocalOwnerId | undefined,
) {
  // Envelope first: a crash before the index remains recoverable from the slot key.
  const envelopeWritten = setStorageValue(ENVELOPE_KEY(envelope.slot, owner), envelope);
  if (!envelopeWritten) return false;
  void writeIndex(index, owner);
  // This mirror allows a running older tab to keep reading its current value.
  void setStorageValue(COMPAT_KEY(envelope.slot, owner), envelope.state);
  return true;
}

/** Returns the envelope, migrating raw v1/v2 values lazily and safely. */
export function readAthleteEnvelope(
  slot: AthleteSlot,
  owner: LocalOwnerId | undefined = null,
): AthleteSaveEnvelope | null {
  if (!isBrowser()) return null;
  const index = readIndex(owner);
  const indexed = index.slots[slot];
  if (indexed?.kind === "deleted") return null;

  const stored = normalizeAthleteSaveEnvelope(
    parseJson(getStorageValue(ENVELOPE_KEY(slot, owner))),
    slot,
  );
  if (stored && (!indexed || indexed.kind !== "saved" || indexed.revision <= stored.revision)) {
    const nextIndex = applyAthleteIndexEntry(index, indexEntryFromEnvelope(stored));
    if (nextIndex !== index) void writeIndex(nextIndex, owner);
    return stored;
  }

  const currentRaw = parseJson(getStorageValue(COMPAT_KEY(slot, owner)));
  const legacyRaw =
    currentRaw ?? (isGuest(owner) ? parseJson(getStorageValue(LEGACY_KEY(slot))) : null);
  const migrated = migrateLegacyAthleteSave(legacyRaw, slot, Date.now(), index);
  if (!migrated) return null;
  const nextIndex = applyAthleteIndexEntry(index, indexEntryFromEnvelope(migrated));
  void persistEnvelope(migrated, nextIndex, owner);
  return migrated;
}

/**
 * Player careers follow the same ownership boundary as manager saves. Legacy
 * browser data is visible to a guest only and cannot surface after sign-in.
 */
export function readAthlete(
  slot: number,
  owner: LocalOwnerId | undefined = null,
): PlayerCareerState | null {
  return isAthleteSlot(slot) ? (readAthleteEnvelope(slot, owner)?.state ?? null) : null;
}

/** Writes an envelope and a current-format mirror before a cloud request is queued. */
export function writeAthlete(
  state: PlayerCareerState,
  owner: LocalOwnerId | undefined = null,
): AthleteSaveEnvelope | null {
  if (!isBrowser() || !isAthleteSlot(state.slot)) return null;
  const index = readIndex(owner);
  const envelope = createAthleteSaveEnvelope(
    state,
    (index.slots[state.slot]?.revision ?? 0) + 1,
    Date.now(),
  );
  if (!envelope) return null;
  const nextIndex = applyAthleteIndexEntry(index, indexEntryFromEnvelope(envelope));
  return persistEnvelope(envelope, nextIndex, owner) ? envelope : null;
}

/** Deletions receive a revisioned tombstone so stale cloud data cannot revive them. */
export function deleteAthlete(
  slot: number,
  owner: LocalOwnerId | undefined = null,
): AthleteDeleteTombstone | null {
  if (!isBrowser() || !isAthleteSlot(slot)) return null;
  const index = readIndex(owner);
  const tombstone: AthleteDeleteTombstone = {
    kind: "deleted",
    slot,
    revision: (index.slots[slot]?.revision ?? 0) + 1,
    deletedAt: Date.now(),
  };
  const nextIndex = applyAthleteIndexEntry(index, tombstone);
  if (!writeIndex(nextIndex, owner)) return null;
  void removeStorageValue(ENVELOPE_KEY(slot, owner));
  void removeStorageValue(COMPAT_KEY(slot, owner));
  if (isGuest(owner)) void removeStorageValue(LEGACY_KEY(slot));
  return tombstone;
}

export function listAthletes(owner: LocalOwnerId | undefined = null): (PlayerCareerState | null)[] {
  return ATHLETE_SLOTS.map((slot) => readAthlete(slot, owner));
}

/** Current raw mirror key, retained for older tabs and compatibility tests. */
export function athleteStorageKey(slot: number, owner: LocalOwnerId | undefined = null) {
  return isAthleteSlot(slot)
    ? COMPAT_KEY(slot, owner)
    : `manager3d.athlete.v2.${localOwnerScope(owner)}.${slot}`;
}

export function athleteEnvelopeStorageKey(
  slot: AthleteSlot,
  owner: LocalOwnerId | undefined = null,
) {
  return ENVELOPE_KEY(slot, owner);
}

export function athleteIndexStorageKey(owner: LocalOwnerId | undefined = null) {
  return INDEX_KEY(owner);
}

export function athleteSyncStorageKey(owner: LocalOwnerId | undefined = null) {
  return OUTBOX_KEY(owner);
}

/** A stable map key for the in-memory flush lock in useAthlete. */
export function athleteSyncScope(owner: LocalOwnerId | undefined = null) {
  return localOwnerScope(owner);
}

export function athleteSyncOperationId(
  operation: AthleteSyncOperation,
  slot: AthleteSlot,
  revision: number,
) {
  return `athlete:${operation}:${slot}:${revision}`;
}

export function createAthleteSaveSyncEntry(
  envelope: AthleteSaveEnvelope,
  queuedAt: number,
): AthleteSyncEntry {
  return {
    version: ATHLETE_SYNC_QUEUE_VERSION,
    operationId: athleteSyncOperationId("save", envelope.slot, envelope.revision),
    operation: "save",
    slot: envelope.slot,
    revision: envelope.revision,
    queuedAt,
    attempts: 0,
    nextAttemptAt: queuedAt,
    state: envelope.state,
  };
}

export function createAthleteDeleteSyncEntry(
  tombstone: AthleteDeleteTombstone,
  queuedAt: number,
): AthleteSyncEntry {
  return {
    version: ATHLETE_SYNC_QUEUE_VERSION,
    operationId: athleteSyncOperationId("delete", tombstone.slot, tombstone.revision),
    operation: "delete",
    slot: tombstone.slot,
    revision: tombstone.revision,
    queuedAt,
    attempts: 0,
    nextAttemptAt: queuedAt,
  };
}

function normalizeAthleteSyncEntry(value: unknown): AthleteSyncEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as {
    version?: unknown;
    operationId?: unknown;
    operation?: unknown;
    slot?: unknown;
    revision?: unknown;
    queuedAt?: unknown;
    attempts?: unknown;
    nextAttemptAt?: unknown;
    state?: unknown;
  };
  if (
    entry.version !== ATHLETE_SYNC_QUEUE_VERSION ||
    (entry.operation !== "save" && entry.operation !== "delete") ||
    !isAthleteSlot(entry.slot) ||
    !isPositiveInteger(entry.revision) ||
    !isNonNegativeInteger(entry.queuedAt) ||
    !isNonNegativeInteger(entry.attempts) ||
    entry.attempts > ATHLETE_SYNC_MAX_ATTEMPTS ||
    !isNonNegativeInteger(entry.nextAttemptAt) ||
    entry.operationId !== athleteSyncOperationId(entry.operation, entry.slot, entry.revision)
  ) {
    return null;
  }

  if (entry.operation === "delete") {
    return {
      version: ATHLETE_SYNC_QUEUE_VERSION,
      operationId: entry.operationId,
      operation: "delete",
      slot: entry.slot,
      revision: entry.revision,
      queuedAt: entry.queuedAt,
      attempts: entry.attempts,
      nextAttemptAt: entry.nextAttemptAt,
    };
  }

  const state = hydrateAthlete(entry.state);
  if (!state) return null;
  return {
    version: ATHLETE_SYNC_QUEUE_VERSION,
    operationId: entry.operationId,
    operation: "save",
    slot: entry.slot,
    revision: entry.revision,
    queuedAt: entry.queuedAt,
    attempts: entry.attempts,
    nextAttemptAt: entry.nextAttemptAt,
    state: { ...state, slot: entry.slot },
  };
}

function queueOrder(a: AthleteSyncEntry, b: AthleteSyncEntry) {
  return a.queuedAt - b.queuedAt || a.slot - b.slot;
}

function shouldReplaceQueuedEntry(
  current: AthleteSyncEntry | undefined,
  candidate: AthleteSyncEntry,
) {
  if (!current) return true;
  if (candidate.revision !== current.revision) return candidate.revision > current.revision;
  // Re-enqueuing the identical operation must not reset its attempt counter or backoff.
  if (candidate.operation === current.operation) return false;
  return candidate.operation === "delete" && current.operation !== "delete";
}

/** Normalization is intentionally pure: malformed/browser-edited queue values cannot grow forever. */
export function normalizeAthleteSyncQueue(value: unknown): AthleteSyncQueue {
  if (!value || typeof value !== "object") return emptyQueue();
  const candidate = value as { version?: unknown; entries?: unknown };
  if (candidate.version !== ATHLETE_SYNC_QUEUE_VERSION || !Array.isArray(candidate.entries))
    return emptyQueue();

  const bySlot = new Map<AthleteSlot, AthleteSyncEntry>();
  for (const raw of candidate.entries) {
    const entry = normalizeAthleteSyncEntry(raw);
    if (entry && shouldReplaceQueuedEntry(bySlot.get(entry.slot), entry))
      bySlot.set(entry.slot, entry);
  }
  return {
    version: ATHLETE_SYNC_QUEUE_VERSION,
    entries: [...bySlot.values()].sort(queueOrder).slice(0, ATHLETE_SYNC_QUEUE_LIMIT),
  };
}

/** Replacing by slot/revision makes duplicate enqueues and late UI events harmless. */
export function enqueueAthleteSync(queue: unknown, candidate: AthleteSyncEntry): AthleteSyncQueue {
  const current = normalizeAthleteSyncQueue(queue);
  const entry = normalizeAthleteSyncEntry(candidate);
  if (!entry) return current;
  const previous = current.entries.find((value) => value.slot === entry.slot);
  if (previous && !shouldReplaceQueuedEntry(previous, entry)) return current;
  return normalizeAthleteSyncQueue({
    version: ATHLETE_SYNC_QUEUE_VERSION,
    entries: [...current.entries.filter((value) => value.slot !== entry.slot), entry],
  });
}

/** Backoff is bounded but operations are not discarded: an offline save remains durable. */
export function athleteSyncBackoffMs(attempts: number) {
  const boundedAttempts = Math.min(ATHLETE_SYNC_MAX_ATTEMPTS, Math.max(1, Math.floor(attempts)));
  return Math.min(ATHLETE_SYNC_MAX_BACKOFF_MS, 1_000 * 2 ** (boundedAttempts - 1));
}

/** Due entries have a deterministic order even when localStorage was manually rearranged. */
export function dueAthleteSyncEntries(queue: unknown, now: number): AthleteSyncEntry[] {
  if (!isNonNegativeInteger(now)) return [];
  return normalizeAthleteSyncQueue(queue)
    .entries.filter((entry) => entry.nextAttemptAt <= now)
    .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt || queueOrder(a, b));
}

/** A late acknowledgement can remove only the exact operation it sent. */
export function acknowledgeAthleteSync(queue: unknown, operationId: string): AthleteSyncQueue {
  const current = normalizeAthleteSyncQueue(queue);
  return normalizeAthleteSyncQueue({
    version: ATHLETE_SYNC_QUEUE_VERSION,
    entries: current.entries.filter((entry) => entry.operationId !== operationId),
  });
}

export function deferAthleteSync(
  queue: unknown,
  operationId: string,
  now: number,
): AthleteSyncQueue {
  if (!isNonNegativeInteger(now)) return normalizeAthleteSyncQueue(queue);
  const current = normalizeAthleteSyncQueue(queue);
  return normalizeAthleteSyncQueue({
    version: ATHLETE_SYNC_QUEUE_VERSION,
    entries: current.entries.map((entry) => {
      if (entry.operationId !== operationId) return entry;
      const attempts = Math.min(ATHLETE_SYNC_MAX_ATTEMPTS, entry.attempts + 1);
      return { ...entry, attempts, nextAttemptAt: now + athleteSyncBackoffMs(attempts) };
    }),
  });
}

export function queuedAthleteSyncForSlot(
  queue: unknown,
  slot: AthleteSlot,
): AthleteSyncEntry | null {
  return normalizeAthleteSyncQueue(queue).entries.find((entry) => entry.slot === slot) ?? null;
}

function readSyncQueue(owner: LocalOwnerId | undefined) {
  return normalizeAthleteSyncQueue(parseJson(getStorageValue(OUTBOX_KEY(owner))));
}

function persistSyncQueue(queue: AthleteSyncQueue, owner: LocalOwnerId | undefined) {
  const normalized = normalizeAthleteSyncQueue(queue);
  if (!normalized.entries.length) return removeStorageValue(OUTBOX_KEY(owner));
  return setStorageValue(OUTBOX_KEY(owner), normalized);
}

export function listAthleteSyncQueue(owner: LocalOwnerId | undefined = null): AthleteSyncQueue {
  return readSyncQueue(owner);
}

export function queueAthleteSave(
  envelope: AthleteSaveEnvelope,
  owner: LocalOwnerId | undefined = null,
) {
  const next = enqueueAthleteSync(
    readSyncQueue(owner),
    createAthleteSaveSyncEntry(envelope, Date.now()),
  );
  return persistSyncQueue(next, owner);
}

export function queueAthleteDelete(
  tombstone: AthleteDeleteTombstone,
  owner: LocalOwnerId | undefined = null,
) {
  const next = enqueueAthleteSync(
    readSyncQueue(owner),
    createAthleteDeleteSyncEntry(tombstone, Date.now()),
  );
  return persistSyncQueue(next, owner);
}

export function dueQueuedAthleteSync(owner: LocalOwnerId | undefined = null, now = Date.now()) {
  return dueAthleteSyncEntries(readSyncQueue(owner), now);
}

export function acknowledgeQueuedAthleteSync(
  operationId: string,
  owner: LocalOwnerId | undefined = null,
) {
  return persistSyncQueue(acknowledgeAthleteSync(readSyncQueue(owner), operationId), owner);
}

export function deferQueuedAthleteSync(
  operationId: string,
  owner: LocalOwnerId | undefined = null,
  now = Date.now(),
) {
  return persistSyncQueue(deferAthleteSync(readSyncQueue(owner), operationId, now), owner);
}

export function hasQueuedAthleteSync(slot: AthleteSlot, owner: LocalOwnerId | undefined = null) {
  return queuedAthleteSyncForSlot(readSyncQueue(owner), slot);
}

export function athleteIsOnline() {
  if (!isBrowser()) return true;
  try {
    return window.navigator.onLine !== false;
  } catch {
    return true;
  }
}
