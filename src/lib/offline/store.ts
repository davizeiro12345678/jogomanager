/**
 * Camada de persistência offline.
 *
 * Guarda a carreira no IndexedDB (mais espaço e mais durável que o
 * localStorage), mantém um histórico das últimas 10 versões e uma fila de
 * envio ("outbox") com o que ainda não foi para a nuvem.
 * O localStorage continua sendo espelhado para leituras síncronas rápidas
 * (a home precisa saber na hora se existe carreira).
 */
import { clear, del, get, getMany, set, setMany, update } from "./indexeddb";

import type { CareerState } from "@/game/types";
import { parseImportJson, record, textField } from "@/lib/import-validation";

export const LEGACY_KEY = "manager3d.career.v1";
export type LocalOwnerId = string | null;
/** Keys are account scoped; an absent owner is the unsigned visitor. */
export function localOwnerScope(owner: LocalOwnerId | undefined = null): string {
  return owner ? `user:${encodeURIComponent(owner)}` : "guest";
}
const K_CAREER = "career.state";
const K_SAVED_AT = "career.savedAt";
const K_SNAPSHOTS = "career.snapshots";
const K_OUTBOX = "career.outbox";
const K_ACK = "career.outbox.ack";
const K_MIGRATION_BACKUPS = "career.migration-backups";
const previousScope = (owner: LocalOwnerId) =>
  owner ? `account-${encodeURIComponent(owner)}` : "guest";
const previousMirrorKey = (owner: LocalOwnerId) => `manager3d.career.v2.${previousScope(owner)}`;
const previousIdbKey = (owner: LocalOwnerId, name: string) =>
  `career.v2.${previousScope(owner)}.${name}`;

const MAX_SNAPSHOTS = 10;
const MAX_ACKNOWLEDGEMENTS = 256;
export function scopedCareerKey(key: string, owner: LocalOwnerId = null): string {
  // Preserve existing unsigned saves; never infer ownership from the next login.
  return owner ? `${key}:${localOwnerScope(owner)}` : key;
}

export interface Snapshot {
  at: number;
  label: string;
  state: CareerState;
}

export interface OutboxEntry {
  at: number;
  state: CareerState;
  /** Present on new entries; timestamps alone can collide between rapid saves. */
  revision?: string;
  /** Transport identity only; never part of CareerState or the simulation RNG. */
  operationId?: string;
}

interface AcknowledgedGeneration {
  entryAt: number;
  operationId?: string;
  fingerprint?: string;
}
interface OutboxAcknowledgements {
  version: 1;
  at: number;
  entries: AcknowledgedGeneration[];
}

const isBrowser = () => typeof window !== "undefined";

function careerRecord(value: unknown): value is CareerState {
  return (
    record(value) &&
    textField(value["clubId"], 80) &&
    textField(value["leagueId"], 80) &&
    textField(value["managerName"], 80)
  );
}

function storageTime(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function snapshotRecords(value: unknown): Snapshot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (copy): copy is Snapshot =>
      record(copy) &&
      typeof copy["at"] === "number" &&
      Number.isFinite(copy["at"]) &&
      typeof copy["label"] === "string" &&
      careerRecord(copy["state"]),
  );
}

/* ------------------------------------------------------------------ *
 * Espelho síncrono (localStorage)
 * ------------------------------------------------------------------ */

function readCareerMirror(key: string): CareerState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = parseImportJson(raw);
    return careerRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function readLocalCareer(owner: LocalOwnerId = null): CareerState | null {
  return (
    readCareerMirror(scopedCareerKey(LEGACY_KEY, owner)) ??
    readCareerMirror(previousMirrorKey(owner))
  );
}

function writeMirrorValue(key: string, value: string): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return window.localStorage.getItem(key) === value;
  } catch {
    return false;
  }
}

function mirror(state: CareerState | null, owner: LocalOwnerId = null) {
  if (state) return writeMirrorValue(scopedCareerKey(LEGACY_KEY, owner), JSON.stringify(state));
  if (!isBrowser()) return true;
  try {
    const keys = [LEGACY_KEY, K_SAVED_AT, K_MIGRATION_BACKUPS, K_OUTBOX, K_ACK].map((key) =>
      scopedCareerKey(key, owner),
    );
    keys.push(previousMirrorKey(owner));
    keys.push(...acknowledgementMirrorKeys(owner));
    for (const key of keys) window.localStorage.removeItem(key);
    return keys.every((key) => window.localStorage.getItem(key) == null);
  } catch {
    /* IndexedDB may still be available. */
  }
  return false;
}

function mirrorSavedAt(owner: LocalOwnerId): number {
  try {
    const value = Number(window.localStorage.getItem(scopedCareerKey(K_SAVED_AT, owner)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ *
 * Carreira
 * ------------------------------------------------------------------ */

export async function loadLocalCareer(owner: LocalOwnerId = null): Promise<CareerState | null> {
  if (!isBrowser()) return null;
  // Compatibility reads are owner scoped and never stamp an old save as new.
  // The first normal save writes the current layout; the original v2 copy stays recoverable.
  return (await exportLocalCareerData(owner)).career;
}

export async function localSavedAt(owner: LocalOwnerId = null): Promise<number> {
  if (!isBrowser()) return 0;
  return (await exportLocalCareerData(owner)).savedAt ?? 0;
}

export async function saveLocalCareer(
  state: CareerState,
  label = "auto",
  owner: LocalOwnerId = null,
) {
  if (!isBrowser()) throw new Error("O armazenamento deste navegador está indisponível.");
  const serialized = JSON.stringify(state);
  const at = Math.max(Date.now(), mirrorSavedAt(owner) + 1);
  const mirrored =
    mirror(state, owner) && writeMirrorValue(scopedCareerKey(K_SAVED_AT, owner), String(at));
  let persisted = false;
  try {
    await setMany([
      [scopedCareerKey(K_CAREER, owner), state],
      [scopedCareerKey(K_SAVED_AT, owner), at],
    ]);
    persisted =
      JSON.stringify(await get(scopedCareerKey(K_CAREER, owner))) === serialized &&
      (await get(scopedCareerKey(K_SAVED_AT, owner))) === at;
    await update<Snapshot[] | undefined>(scopedCareerKey(K_SNAPSHOTS, owner), (list) =>
      [{ at, label, state }, ...(Array.isArray(list) ? list : [])].slice(0, MAX_SNAPSHOTS),
    );
  } catch {
    /* The verified mirror remains usable when IndexedDB is unavailable. */
  }
  if (!mirrored && !persisted)
    throw new Error(
      "Não foi possível salvar a carreira. Verifique o armazenamento antes de continuar.",
    );
}

function mirroredMigrationBackups(owner: LocalOwnerId): Snapshot[] {
  try {
    const value = parseImportJson(
      window.localStorage.getItem(scopedCareerKey(K_MIGRATION_BACKUPS, owner)) ?? "[]",
    );
    return Array.isArray(value) ? (value as Snapshot[]) : [];
  } catch {
    return [];
  }
}

function mergeMigrationBackups(...sources: unknown[]): Snapshot[] {
  const copies = sources.flatMap(snapshotRecords).sort((left, right) => right.at - left.at);
  const seen = new Set<string>();
  return copies
    .filter((copy) => {
      const key = JSON.stringify(copy.state);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

/** Recovery copies are separate from autosave rotation and must survive a read-back. */
export async function backupCareerBeforeMigration(state: CareerState, owner: LocalOwnerId = null) {
  if (!isBrowser()) throw new Error("O backup de migração exige armazenamento local.");
  const key = scopedCareerKey(K_MIGRATION_BACKUPS, owner);
  let stored: Snapshot[] | undefined;
  try {
    stored = await get<Snapshot[]>(key);
  } catch {
    /* Mirror-only copies still need to be retained. */
  }
  const copies = mergeMigrationBackups(
    [{ at: Date.now(), label: "Antes da migração", state }],
    stored,
    mirroredMigrationBackups(owner),
  );
  const serialized = JSON.stringify(copies);
  const original = JSON.stringify(state);
  const mirrored = writeMirrorValue(key, serialized);
  let persisted = false;
  try {
    await update<Snapshot[] | undefined>(key, (current) => mergeMigrationBackups(copies, current));
    const confirmed = await get<Snapshot[]>(key);
    persisted =
      Array.isArray(confirmed) && confirmed.some((copy) => JSON.stringify(copy.state) === original);
  } catch {
    /* A verified mirror is sufficient. */
  }
  if (!persisted && !mirrored)
    throw new Error(
      "Não foi possível confirmar o backup anterior à migração. O save foi preservado.",
    );
}

export async function listSnapshots(owner: LocalOwnerId = null): Promise<Snapshot[]> {
  if (!isBrowser()) return [];
  return (await exportLocalCareerData(owner)).snapshots;
}

/** Exporta os dados de carreira guardados no IndexedDB sem iniciar migrações. */
export async function exportLocalCareerData(owner: LocalOwnerId = null) {
  if (!isBrowser()) {
    return {
      career: null,
      savedAt: null,
      snapshots: [],
      migrationBackups: [],
      pendingSync: null,
      previousLayout: { career: null, savedAt: null, snapshots: [], pendingSync: null },
    };
  }
  let stored: [
    CareerState | undefined,
    number | undefined,
    Snapshot[] | undefined,
    OutboxEntry | undefined,
    Snapshot[] | undefined,
    CareerState | undefined,
    number | undefined,
    Snapshot[] | undefined,
    OutboxEntry | undefined,
    unknown,
  ] = [
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ];
  try {
    stored = (await getMany([
      ...[K_CAREER, K_SAVED_AT, K_SNAPSHOTS, K_OUTBOX, K_MIGRATION_BACKUPS].map((key) =>
        scopedCareerKey(key, owner),
      ),
      ...["career", "savedAt", "snapshots", "outbox"].map((name) => previousIdbKey(owner, name)),
      scopedCareerKey(K_ACK, owner),
    ])) as typeof stored;
  } catch {
    /* Privacy export remains available from the verified mirror. */
  }
  const [
    career,
    savedAt,
    snapshots,
    pendingSync,
    migrationBackups,
    previousCareer,
    previousAt,
    previousSnapshots,
    previousOutbox,
    storedAcknowledgements,
  ] = stored;
  const currentMirror = readCareerMirror(scopedCareerKey(LEGACY_KEY, owner));
  const oldMirror = readCareerMirror(previousMirrorKey(owner));
  const canonicalCandidates = [
    { state: career, at: storageTime(savedAt) },
    { state: currentMirror, at: mirrorSavedAt(owner) },
  ].filter((candidate) => careerRecord(candidate.state));
  const candidates = (
    canonicalCandidates.length
      ? canonicalCandidates
      : [
          { state: previousCareer, at: storageTime(previousAt) },
          { state: oldMirror, at: storageTime(previousAt) },
          { state: previousOutbox?.state, at: storageTime(previousOutbox?.at) },
        ].filter((candidate) => careerRecord(candidate.state))
  ).sort((left, right) => right.at - left.at);
  const selected = candidates[0];
  const mirrorOutbox = readQueueMirror(owner);
  const pending = await selectOutbox(
    pendingSync,
    mirrorOutbox,
    previousOutbox,
    withMirrorAcknowledgements(storedAcknowledgements, owner),
  );
  return {
    career: selected?.state ?? null,
    savedAt: selected?.at || null,
    snapshots: [...snapshotRecords(snapshots), ...snapshotRecords(previousSnapshots)]
      .sort((left, right) => right.at - left.at)
      .slice(0, MAX_SNAPSHOTS),
    migrationBackups: mergeMigrationBackups(migrationBackups, mirroredMigrationBackups(owner)),
    pendingSync: pending,
    previousLayout: {
      career: careerRecord(previousCareer) ? previousCareer : oldMirror,
      savedAt: storageTime(previousAt) || null,
      snapshots: snapshotRecords(previousSnapshots),
      pendingSync: previousOutbox ?? null,
    },
  };
}

/** Remove apenas carreira, versões locais e fila de sincronização. */
export async function clearLocalCareerData(owner: LocalOwnerId = null): Promise<boolean> {
  const mirrorCleared = mirror(null, owner);
  if (!isBrowser()) return true;
  try {
    await Promise.all([
      del(scopedCareerKey(K_CAREER, owner)),
      del(scopedCareerKey(K_SAVED_AT, owner)),
      del(scopedCareerKey(K_SNAPSHOTS, owner)),
      del(scopedCareerKey(K_OUTBOX, owner)),
      del(scopedCareerKey(K_ACK, owner)),
      del(scopedCareerKey(K_MIGRATION_BACKUPS, owner)),
      ...["career", "savedAt", "snapshots", "outbox"].map((name) =>
        del(previousIdbKey(owner, name)),
      ),
    ]);
    return mirrorCleared;
  } catch {
    return false;
  }
}

export async function clearLocalCareer(owner: LocalOwnerId = null) {
  if (!(await clearLocalCareerData(owner)))
    throw new Error(
      "Não foi possível apagar a carreira local. Confira o armazenamento antes de continuar.",
    );
}

export async function wipeEverything() {
  if (!isBrowser()) return;
  let mirrored = false;
  try {
    const storage = window.localStorage;
    const bases = [LEGACY_KEY, K_SAVED_AT, K_MIGRATION_BACKUPS, K_OUTBOX, K_ACK];
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string =>
        key !== null &&
        (key.startsWith("manager3d.career.v2.") ||
          key.startsWith(`${K_ACK}:generation:`) ||
          bases.some((base) => key === base || key.startsWith(`${base}:user:`))),
    );
    for (const key of keys) storage.removeItem(key);
    mirrored = keys.every((key) => storage.getItem(key) === null);
  } catch {
    /* Still attempt to clear IndexedDB, but never report a partial wipe as complete. */
  }
  await clear();
  if (!mirrored) throw new Error("Não foi possível apagar todas as cópias locais da carreira.");
}

/* ------------------------------------------------------------------ *
 * Fila de envio
 * ------------------------------------------------------------------ */

export async function queueSync(state: CareerState, owner: LocalOwnerId = null) {
  if (!isBrowser()) throw new Error("A fila de sincronização exige armazenamento local.");
  const operationId = transportOperationId();
  const entry: OutboxEntry = { at: Math.max(Date.now(), mirrorSavedAt(owner)), state, operationId };
  const serialized = JSON.stringify(entry);
  const key = scopedCareerKey(K_OUTBOX, owner);
  const mirrored = writeMirrorValue(key, serialized);
  let persisted = false;
  try {
    await set(key, entry);
    persisted = JSON.stringify(await get(key)) === serialized;
  } catch {
    /* The verified scoped mirror can retain the queue while IDB is unavailable. */
  }
  if (!mirrored && !persisted)
    throw new Error(
      "Não foi possível confirmar a fila de sincronização. A carreira local foi mantida.",
    );
  return entry;
}

function transportOperationId(): string {
  const random = new Uint32Array(4);
  // getRandomValues works on HTTP too; randomUUID requires a secure context.
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else
    for (let index = 0; index < random.length; index++) random[index] = Math.random() * 0x100000000;
  return [...random].map((part) => part.toString(16).padStart(8, "0")).join("");
}

function readQueueMirror(owner: LocalOwnerId): OutboxEntry | null | undefined {
  try {
    const raw = window.localStorage.getItem(scopedCareerKey(K_OUTBOX, owner));
    if (raw == null) return undefined;
    const value = parseImportJson(raw);
    return value === null
      ? null
      : outboxRecord(value)
        ? (value as unknown as OutboxEntry)
        : undefined;
  } catch {
    return undefined;
  }
}

function outboxRecord(value: unknown): value is OutboxEntry {
  return (
    record(value) &&
    typeof value["at"] === "number" &&
    Number.isFinite(value["at"]) &&
    value["at"] >= 0 &&
    careerRecord(value["state"]) &&
    (value["revision"] === undefined ||
      (typeof value["revision"] === "string" &&
        value["revision"].length > 0 &&
        value["revision"].length <= 128)) &&
    (value["operationId"] === undefined ||
      (typeof value["operationId"] === "string" && /^[a-f0-9]{32}$/.test(value["operationId"])))
  );
}

function acknowledgementRecord(value: unknown): value is OutboxAcknowledgements {
  return (
    record(value) &&
    value["version"] === 1 &&
    typeof value["at"] === "number" &&
    Number.isFinite(value["at"]) &&
    value["at"] >= 0 &&
    Array.isArray(value["entries"]) &&
    value["entries"].length <= MAX_ACKNOWLEDGEMENTS &&
    value["entries"].every(
      (entry: unknown) =>
        record(entry) &&
        typeof entry["entryAt"] === "number" &&
        Number.isFinite(entry["entryAt"]) &&
        entry["entryAt"] >= 0 &&
        ((typeof entry["operationId"] === "string" &&
          /^[a-f0-9]{32}$/.test(entry["operationId"]) &&
          entry["fingerprint"] === undefined) ||
          (entry["operationId"] === undefined &&
            typeof entry["fingerprint"] === "string" &&
            (/^sha256:[a-f0-9]{64}$/.test(entry["fingerprint"]) ||
              entry["fingerprint"].startsWith("json:")))),
    )
  );
}

function acknowledgementMirrorKeys(owner: LocalOwnerId): string[] {
  const base = scopedCareerKey(K_ACK, owner);
  const storage = window.localStorage;
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key !== null && key.startsWith(`${base}:generation:`),
  );
}

function acknowledgementMirrors(owner: LocalOwnerId): [string, OutboxAcknowledgements][] {
  try {
    const keys = [scopedCareerKey(K_ACK, owner), ...acknowledgementMirrorKeys(owner)];
    return keys.flatMap((key): [string, OutboxAcknowledgements][] => {
      try {
        const value = parseImportJson(window.localStorage.getItem(key) ?? "null");
        if (!acknowledgementRecord(value)) return [];
        if (key !== scopedCareerKey(K_ACK, owner)) {
          const token = key.slice(`${scopedCareerKey(K_ACK, owner)}:generation:`.length);
          if (
            !/^[a-f0-9]{32}$/.test(token) ||
            value.entries.length !== 1 ||
            (value.entries[0]?.operationId && value.entries[0].operationId !== token)
          )
            return [];
        }
        return [[key, value]];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function withMirrorAcknowledgements(stored: unknown, owner: LocalOwnerId): OutboxAcknowledgements {
  return combineAcknowledgements(
    mergeAcknowledgements(stored),
    ...acknowledgementMirrors(owner).map(([, value]) => value),
  );
}

function writeAcknowledgementsMirror(owner: LocalOwnerId, ack: OutboxAcknowledgements): boolean {
  try {
    const serialized = JSON.stringify(ack);
    // Legacy exact-JSON fingerprints can grow after escaping. A raw read-back is
    // insufficient if our bounded reader could never decode the stored ACK.
    if (!acknowledgementRecord(parseImportJson(serialized))) return false;
    const identity = ack.entries[0];
    if (ack.entries.length !== 1 || !identity) return false;
    const existing = acknowledgementMirrors(owner).find(
      ([key, value]) =>
        key.includes(":generation:") &&
        value.entries.length === 1 &&
        JSON.stringify(value.entries[0]) === JSON.stringify(identity),
    );
    const key =
      existing?.[0] ??
      `${scopedCareerKey(K_ACK, owner)}:generation:${identity.operationId ?? transportOperationId()}`;
    return writeMirrorValue(key, serialized);
  } catch {
    return false;
  }
}

function mergeAcknowledgements(...values: unknown[]): OutboxAcknowledgements {
  return combineAcknowledgements(...values.filter(acknowledgementRecord));
}

function combineAcknowledgements(...valid: OutboxAcknowledgements[]): OutboxAcknowledgements {
  const entries = new Map<string, AcknowledgedGeneration>();
  for (const value of valid)
    for (const entry of value.entries) entries.set(JSON.stringify(entry), entry);
  return {
    version: 1,
    at: Math.max(0, ...valid.map((value) => value.at)),
    entries: [...entries.values()],
  };
}

async function readAcknowledgements(owner: LocalOwnerId): Promise<OutboxAcknowledgements> {
  let stored: unknown;
  try {
    stored = await get(scopedCareerKey(K_ACK, owner));
  } catch {
    /* verified mirror */
  }
  return withMirrorAcknowledgements(stored, owner);
}

async function stateFingerprint(state: CareerState): Promise<string> {
  const serialized = JSON.stringify(state);
  if (!globalThis.crypto?.subtle) return `json:${serialized}`;
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function generation(entry: OutboxEntry): Promise<AcknowledgedGeneration> {
  return entry.operationId
    ? { entryAt: entry.at, operationId: entry.operationId }
    : entry.revision
      ? {
          entryAt: entry.at,
          fingerprint: `json:${JSON.stringify({ revision: entry.revision, state: entry.state })}`,
        }
      : { entryAt: entry.at, fingerprint: await stateFingerprint(entry.state) };
}

async function selectOutbox(
  current: OutboxEntry | null | undefined,
  mirrored: OutboxEntry | null | undefined,
  previous: OutboxEntry | undefined,
  acknowledgements: OutboxAcknowledgements,
): Promise<OutboxEntry | null> {
  const pending = async (value: unknown): Promise<OutboxEntry | null | undefined> => {
    if (!outboxRecord(value)) return value === null ? null : undefined;
    const identity = await generation(value);
    return acknowledgements.entries.some(
      (ack) =>
        ack.entryAt === identity.entryAt &&
        (identity.operationId
          ? ack.operationId === identity.operationId
          : ack.fingerprint === identity.fingerprint),
    )
      ? null
      : value;
  };
  const [live, mirrorEntry] = await Promise.all([pending(current), pending(mirrored)]);
  const entries = [mirrorEntry, live].filter((entry): entry is OutboxEntry => Boolean(entry));
  if (entries.length) return entries.sort((left, right) => right.at - left.at)[0]!;
  const historical = await pending(previous);
  // Untagged historical queues remain suppressed by the compatibility tombstone.
  // Latest-main revision-tagged generations must be acknowledged individually:
  // an older upload cannot retire a newer revision written to that layout.
  return (live === null || mirrorEntry === null) && !historical?.revision
    ? null
    : (historical ?? null);
}

export async function readOutbox(owner: LocalOwnerId = null): Promise<OutboxEntry | null> {
  if (!isBrowser()) return null;
  try {
    const [current, previous, ack] = (await getMany([
      scopedCareerKey(K_OUTBOX, owner),
      previousIdbKey(owner, "outbox"),
      scopedCareerKey(K_ACK, owner),
    ])) as [OutboxEntry | null | undefined, OutboxEntry | undefined, unknown];
    return selectOutbox(
      current,
      readQueueMirror(owner),
      previous,
      withMirrorAcknowledgements(ack, owner),
    );
  } catch {
    const mirrored = readQueueMirror(owner);
    if (mirrored === undefined)
      throw new Error("Não foi possível conferir a fila de sincronização neste navegador.");
    return selectOutbox(
      undefined,
      mirrored,
      undefined,
      withMirrorAcknowledgements(undefined, owner),
    );
  }
}

export async function clearOutbox(
  owner: LocalOwnerId = null,
  expectedState?: CareerState,
  expectedEntry?: OutboxEntry,
): Promise<boolean> {
  if (!isBrowser()) return false;
  const key = scopedCareerKey(K_OUTBOX, owner);
  const captured = expectedEntry ?? (await readOutbox(owner));
  if (!captured) return true;
  if (expectedState && JSON.stringify(captured.state) !== JSON.stringify(expectedState))
    return false;
  const identity = await generation(captured);
  const ackKey = scopedCareerKey(K_ACK, owner);
  const matching = (entry: OutboxEntry | null | undefined) =>
    entry &&
    (captured.operationId
      ? entry.operationId === captured.operationId
      : !entry.operationId &&
        entry.revision === captured.revision &&
        entry.at === captured.at &&
        JSON.stringify(entry.state) === JSON.stringify(captured.state));
  const prior = await readAcknowledgements(owner);
  const retiredBefore = new Set<string>();
  if (prior.entries.length >= MAX_ACKNOWLEDGEMENTS) {
    try {
      // After storage recovery a replacement durably present in BOTH stores proves
      // the old acknowledged generations are gone, even before its own ACK is written.
      if (matching(await get<OutboxEntry>(key)) && matching(readQueueMirror(owner)))
        for (const entry of prior.entries)
          if (JSON.stringify(entry) !== JSON.stringify(identity))
            retiredBefore.add(JSON.stringify(entry));
    } catch {
      /* No proof: preserve the ledger and fail explicitly at its limit. */
    }
  }
  const withoutRetired = (value: unknown) => {
    const current = mergeAcknowledgements(value);
    return {
      ...current,
      entries: current.entries.filter((entry) => !retiredBefore.has(JSON.stringify(entry))),
    };
  };
  const retained = new Map(
    prior.entries
      .filter((entry) => !retiredBefore.has(JSON.stringify(entry)))
      .map((entry) => [JSON.stringify(entry), entry]),
  );
  retained.set(JSON.stringify(identity), identity);
  // A union can exceed the on-disk limit even when both inputs are valid.
  // Never pass it back through the storage validator, which would drop it.
  const ack: OutboxAcknowledgements = {
    version: 1,
    at: Math.max(prior.at, 0, Date.now()),
    entries: [...retained.values()],
  };
  if (ack.entries.length > MAX_ACKNOWLEDGEMENTS)
    throw new Error(
      "O histórico de confirmações está cheio. A fila foi preservada para recuperação segura.",
    );
  const mirroredAck = writeAcknowledgementsMirror(owner, { ...ack, entries: [identity] });
  // Re-read after asynchronous hashing: a new generation may have arrived meanwhile.
  if (mirroredAck && matching(readQueueMirror(owner))) writeMirrorValue(key, "null");
  let persistedAck = false;
  try {
    await update<OutboxAcknowledgements | undefined>(ackKey, (current) => {
      const merged = mergeAcknowledgements(withoutRetired(current), ack);
      if (merged.entries.length > MAX_ACKNOWLEDGEMENTS)
        throw new Error("O histórico de confirmações está cheio.");
      return merged;
    });
    const confirmed = await get(ackKey);
    persistedAck =
      acknowledgementRecord(confirmed) &&
      confirmed.entries.some((entry) => JSON.stringify(entry) === JSON.stringify(identity));
    if (!mirroredAck && !persistedAck) return false;
    // update serializes the comparison and write in the same IDB transaction.
    // Null acknowledges the canonical queue and suppresses historical-layout replay.
    await update<OutboxEntry | null | undefined>(key, (current) => {
      return matching(current) || !current ? null : current;
    });
    // Retire only this captured generation in latest-main's previous layout.
    // Its transaction preserves a newer legacy revision queued during upload.
    await update<OutboxEntry | null | undefined>(previousIdbKey(owner, "outbox"), (current) =>
      matching(current) ? null : current,
    );
  } catch {
    /* A durable scoped acknowledgement also suppresses a stale IDB copy after recovery. */
  }
  if (persistedAck) {
    try {
      // Keep explicit nulls: deleting either key would permit historical-layout replay.
      // Only generations from this acknowledgement are retired; concurrently added ACKs survive.
      if ((await get(key)) === null && readQueueMirror(owner) === null) {
        const retired = new Set(
          [...prior.entries, ...ack.entries].map((entry) => JSON.stringify(entry)),
        );
        const retain = (value: unknown) => {
          const current = mergeAcknowledgements(value);
          return {
            ...current,
            entries: current.entries.filter(
              (entry) =>
                !retired.has(JSON.stringify(entry)) ||
                JSON.stringify(entry) === JSON.stringify(identity),
            ),
          };
        };
        await update<OutboxAcknowledgements | undefined>(ackKey, retain);
        for (const [mirrorKey, value] of acknowledgementMirrors(owner)) {
          const compactMirror = retain(value);
          if (readQueueMirror(owner) !== null) break;
          if (mirrorKey === ackKey) {
            // Compatibility ledger: current writers only append generation keys.
            const before = window.localStorage.getItem(mirrorKey);
            if (before === JSON.stringify(value))
              writeMirrorValue(mirrorKey, JSON.stringify(compactMirror));
          } else if (!compactMirror.entries.length) {
            // Each generation owns its key: retiring A cannot erase concurrent B.
            window.localStorage.removeItem(mirrorKey);
          }
        }
      }
    } catch {
      /* Retain all ACKs if durable deletion/compaction cannot be confirmed. */
    }
  }
  return (mirroredAck || persistedAck) && (await readOutbox(owner)) === null;
}

/** A completed upload must not erase a save queued while the network was busy. */
export async function acknowledgeOutbox(
  uploaded: OutboxEntry | null,
  owner: LocalOwnerId,
): Promise<boolean> {
  if (!uploaded) return false;
  return clearOutbox(owner, uploaded.state, uploaded);
}

export function isOnline() {
  if (!isBrowser()) return true;
  return navigator.onLine !== false;
}
