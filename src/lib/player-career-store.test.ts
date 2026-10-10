import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLUBS } from "@/game/data/leagues";
import { createAthlete } from "@/game/player-career/engine";
import {
  acknowledgeAthleteSync,
  applyAthleteIndexEntry,
  athleteEnvelopeStorageKey,
  athleteIndexStorageKey,
  athleteSyncBackoffMs,
  athleteSyncOperationId,
  athleteStorageKey,
  createAthleteSaveEnvelope,
  createAthleteSaveSyncEntry,
  deferAthleteSync,
  dueAthleteSyncEntries,
  enqueueAthleteSync,
  listAthletes,
  migrateLegacyAthleteSave,
  normalizeAthleteSyncQueue,
  readAthlete,
  writeAthlete,
} from "./player-career-store";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const clubId = Object.keys(CLUBS)[0]!;
let storage: MemoryStorage;
const athlete = (slot: 1 | 2 | 3, name: string) =>
  createAthlete(
    {
      slot,
      name,
      nickname: name,
      nation: "Brasil",
      hometown: "Rio",
      position: "ATA",
      foot: "direito",
      heightCm: 182,
      build: "atletico",
      personality: "profissional",
      origin: "base",
      clubId,
      appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, boots: 0 },
      shirtNumber: 9,
    },
    name === "Alice" ? 1000 : 2000,
  );

describe("athlete local owner boundary", () => {
  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not reveal an athlete from one account to another account or a visitor", () => {
    const alice = athlete(1, "Alice");
    const bruno = athlete(1, "Bruno");
    writeAthlete(alice, "alice-id");
    writeAthlete(bruno, "bruno-id");

    expect(readAthlete(1, "alice-id")).toMatchObject({ name: alice.name, seed: alice.seed });
    expect(readAthlete(1, "bruno-id")).toMatchObject({ name: bruno.name, seed: bruno.seed });
    expect(readAthlete(1)).toBeNull();
    expect(listAthletes("alice-id")[0]).toMatchObject({ name: alice.name, seed: alice.seed });
    expect(athleteStorageKey(1, "alice-id")).not.toEqual(athleteStorageKey(1, "bruno-id"));
  });

  it("migrates raw localStorage values to a versioned envelope and a per-slot index", () => {
    const legacy = athlete(2, "Migração");
    storage.setItem(athleteStorageKey(2), JSON.stringify(legacy));

    expect(readAthlete(2)).toMatchObject({ name: legacy.name, slot: 2 });

    const envelope = JSON.parse(storage.getItem(athleteEnvelopeStorageKey(2)) ?? "null") as {
      version: number;
      kind: string;
      slot: number;
      revision: number;
      state: { name: string };
    };
    const index = JSON.parse(storage.getItem(athleteIndexStorageKey()) ?? "null") as {
      version: number;
      slots: Record<string, { kind: string; revision: number }>;
    };
    expect(envelope).toMatchObject({
      version: 1,
      kind: "athlete-save",
      slot: 2,
      revision: 1,
      state: { name: legacy.name },
    });
    expect(index).toMatchObject({ version: 1, slots: { 2: { kind: "saved", revision: 1 } } });
  });

  it("hydrates the additive appearance contract from a guest legacy save", () => {
    const legacy = athlete(1, "Alice");
    window.localStorage.setItem("manager3d.athlete.v1.1", JSON.stringify(legacy));

    const hydrated = readAthlete(1);

    expect(hydrated?.appearanceV1).toMatchObject({
      version: 1,
      skinTone: legacy.appearance.skin,
      hairColor: legacy.appearance.hairColor,
      bootVariant: legacy.appearance.boots,
    });
  });
});

describe("athlete sync queue", () => {
  const save = (slot: 1 | 2 | 3, revision: number, at: number) => {
    const envelope = createAthleteSaveEnvelope(athlete(slot, `Atleta ${slot}`), revision, at);
    if (!envelope) throw new Error("Envelope de teste inválido.");
    return createAthleteSaveSyncEntry(envelope, at);
  };

  it("keeps one idempotent latest operation per slot and bounds the queue to the three slots", () => {
    const first = save(1, 1, 10);
    const newer = save(1, 2, 20);
    const second = save(2, 1, 30);
    const third = save(3, 1, 40);

    let queue = enqueueAthleteSync(undefined, first);
    queue = enqueueAthleteSync(queue, first);
    expect(queue.entries[0]).toMatchObject({ revision: 1, queuedAt: 10, attempts: 0 });
    queue = enqueueAthleteSync(queue, newer);
    queue = enqueueAthleteSync(queue, second);
    queue = enqueueAthleteSync(queue, third);

    expect(queue.entries).toHaveLength(3);
    expect(queue.entries.find((entry) => entry.slot === 1)).toMatchObject({
      revision: 2,
      operationId: newer.operationId,
    });
    expect(
      normalizeAthleteSyncQueue({ version: 1, entries: [first, newer, second, third] }).entries,
    ).toHaveLength(3);
  });

  it("orders due work deterministically and a late acknowledgement cannot remove a newer revision", () => {
    const first = save(1, 1, 300);
    const second = save(2, 1, 100);
    const third = save(3, 1, 100);
    const newer = save(1, 2, 400);
    const ordered = normalizeAthleteSyncQueue({ version: 1, entries: [first, third, second] });

    expect(dueAthleteSyncEntries(ordered, 500).map((entry) => entry.slot)).toEqual([2, 3, 1]);

    const replaced = enqueueAthleteSync(ordered, newer);
    const lateAck = acknowledgeAthleteSync(replaced, first.operationId);
    expect(lateAck.entries.find((entry) => entry.slot === 1)).toMatchObject({
      revision: 2,
      operationId: newer.operationId,
    });
  });

  it("backs off failed entries without dropping them", () => {
    const first = save(1, 1, 100);
    const queued = enqueueAthleteSync(undefined, first);
    const deferred = deferAthleteSync(queued, first.operationId, 500);
    const retry = deferred.entries[0]!;
    const requeued = enqueueAthleteSync(deferred, first);

    expect(retry).toMatchObject({ attempts: 1, nextAttemptAt: 1_500 });
    expect(requeued).toEqual(deferred);
    expect(dueAthleteSyncEntries(deferred, 1_499)).toEqual([]);
    expect(dueAthleteSyncEntries(deferred, 1_500).map((entry) => entry.operationId)).toEqual([
      first.operationId,
    ]);
    expect(athleteSyncBackoffMs(1)).toBe(1_000);
    expect(athleteSyncBackoffMs(99)).toBeLessThanOrEqual(5 * 60 * 1_000);
  });

  it("creates a pure migration envelope whose index remains monotonic", () => {
    const raw = athlete(1, "Legado");
    const migrated = migrateLegacyAthleteSave(raw, 1, 2_000);
    if (!migrated) throw new Error("Migração de teste inválida.");
    const index = applyAthleteIndexEntry(undefined, {
      kind: "saved",
      slot: migrated.slot,
      revision: migrated.revision,
      savedAt: migrated.savedAt,
      stateUpdatedAt: migrated.state.updatedAt,
    });
    const retry = migrateLegacyAthleteSave(raw, 1, 3_000, index);

    expect(migrated).toMatchObject({ version: 1, kind: "athlete-save", slot: 1, revision: 1 });
    expect(retry).toMatchObject({ slot: 1, revision: 2, savedAt: 3_000 });
    expect(athleteSyncOperationId("save", 1, 2)).toBe("athlete:save:1:2");
  });
});
