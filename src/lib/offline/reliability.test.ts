import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerState } from "@/game/types";

const db = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  unavailable: false,
  barrierKey: "",
  waiting: [] as (() => void)[],
}));
vi.mock("idb-keyval", () => {
  const available = () => {
    if (db.unavailable) throw new DOMException("Synthetic storage failure", "AbortError");
  };
  return {
    get: async (key: string) => {
      available();
      const value = structuredClone(db.rows.get(key));
      if (key === db.barrierKey) {
        await new Promise<void>((resolve) => {
          db.waiting.push(resolve);
          if (db.waiting.length === 2) {
            db.barrierKey = "";
            for (const release of db.waiting) release();
          }
        });
      }
      return value;
    },
    getMany: async (keys: string[]) => {
      available();
      return structuredClone(keys.map((key) => db.rows.get(key)));
    },
    set: async (key: string, value: unknown) => {
      available();
      db.rows.set(key, structuredClone(value));
    },
    setMany: async (entries: [string, unknown][]) => {
      available();
      for (const [key, value] of structuredClone(entries)) db.rows.set(key, value);
    },
    update: async (key: string, updater: (value: unknown) => unknown) => {
      available();
      db.rows.set(key, structuredClone(updater(structuredClone(db.rows.get(key)))));
    },
    del: async (key: string) => {
      available();
      db.rows.delete(key);
    },
    clear: async () => {
      available();
      db.rows.clear();
    },
  };
});
import {
  backupCareerBeforeMigration,
  clearLocalCareer,
  clearOutbox,
  exportLocalCareerData,
  loadLocalCareer,
  queueSync,
  readOutbox,
  saveLocalCareer,
  scopedCareerKey,
  wipeEverything,
} from "./store";

const career = (round: number) =>
  ({
    version: 3,
    clubId: "qa-club",
    leagueId: "qa-league",
    managerName: "Synthetic QA",
    round,
  }) as CareerState;
let mirror: Map<string, string>;
beforeEach(() => {
  db.rows.clear();
  db.unavailable = false;
  db.barrierKey = "";
  db.waiting = [];
  mirror = new Map();
  vi.spyOn(Date, "now").mockReturnValue(1000);
  vi.stubGlobal("window", {
    localStorage: {
      get length() {
        return mirror.size;
      },
      key: (index: number) => [...mirror.keys()][index] ?? null,
      getItem: (key: string) => mirror.get(key) ?? null,
      setItem: (key: string, value: string) => mirror.set(key, value),
      removeItem: (key: string) => mirror.delete(key),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("local persistence failure boundaries", () => {
  it("does not replay an acknowledged IDB queue after a mirror-only acknowledgement recovers", async () => {
    await queueSync(career(1), "qa-alice");
    db.unavailable = true;
    expect(await clearOutbox("qa-alice", career(1))).toBe(true);
    db.unavailable = false;
    expect(await readOutbox("qa-alice")).toBeNull();
  });

  it("does not acknowledge a replacement generation with identical JSON after the clock regresses", async () => {
    await queueSync(career(1), "qa-alice");
    const captured = (await readOutbox("qa-alice"))!;
    vi.mocked(Date.now).mockReturnValue(10);
    await queueSync(career(1), "qa-alice");
    const replacement = (await readOutbox("qa-alice"))!;
    expect(await clearOutbox("qa-alice", captured.state, captured)).toBe(false);
    expect(await readOutbox("qa-alice")).toEqual(replacement);
    expect(replacement.operationId).not.toBe(captured.operationId);
  });

  it("matches legacy acknowledgements by both timestamp and payload and keeps another owner pending", async () => {
    const key = scopedCareerKey("career.outbox", "qa-alice");
    const legacy = { at: 2000, state: career(1) };
    db.rows.set(key, legacy);
    mirror.set(key, JSON.stringify(legacy));
    await queueSync(career(1), "qa-bob");
    db.unavailable = true;
    expect(await clearOutbox("qa-alice", legacy.state, legacy)).toBe(true);
    db.unavailable = false;
    expect(await readOutbox("qa-alice")).toBeNull();
    db.rows.set(key, { at: 2001, state: career(1) });
    expect((await readOutbox("qa-alice"))?.at).toBe(2001);
    expect((await readOutbox("qa-bob"))?.state).toEqual(career(1));
  });

  it("ignores malformed acknowledgement metadata instead of discarding pending progress", async () => {
    await queueSync(career(1), "qa-alice");
    const captured = (await readOutbox("qa-alice"))!;
    const ack = {
      version: 1,
      at: Infinity,
      entries: [{ entryAt: captured.at, operationId: captured.operationId }],
    };
    db.rows.set(scopedCareerKey("career.outbox.ack", "qa-alice"), ack);
    mirror.set(scopedCareerKey("career.outbox.ack", "qa-alice"), JSON.stringify(ack));
    expect(await readOutbox("qa-alice")).toEqual(captured);
  });

  it("retains earlier acknowledgements across multiple offline confirmations", async () => {
    await queueSync(career(1), "qa-alice");
    const first = (await readOutbox("qa-alice"))!;
    db.unavailable = true;
    expect(await clearOutbox("qa-alice", first.state, first)).toBe(true);
    await queueSync(career(2), "qa-alice");
    const second = (await readOutbox("qa-alice"))!;
    expect(await clearOutbox("qa-alice", second.state, second)).toBe(true);
    db.unavailable = false;
    expect(await readOutbox("qa-alice")).toBeNull();
  });

  it("retains confirmations for two different captured generations acknowledged concurrently offline", async () => {
    await queueSync(career(1), "qa-alice");
    const first = (await readOutbox("qa-alice"))!;
    db.unavailable = true;
    await queueSync(career(2), "qa-alice");
    const second = (await readOutbox("qa-alice"))!;
    await Promise.all([
      clearOutbox("qa-alice", first.state, first),
      clearOutbox("qa-alice", second.state, second),
    ]);
    db.unavailable = false;
    expect(await readOutbox("qa-alice")).toBeNull();
  });

  it("retains safe confirmations when generation-key cleanup fails after durable acknowledgement", async () => {
    await queueSync(career(1), "qa-alice");
    const first = (await readOutbox("qa-alice"))!;
    db.unavailable = true;
    await clearOutbox("qa-alice", first.state, first);
    db.unavailable = false;
    await queueSync(career(2), "qa-alice");
    const second = (await readOutbox("qa-alice"))!;
    const prefix = `${scopedCareerKey("career.outbox.ack", "qa-alice")}:generation:`;
    vi.spyOn(window.localStorage, "removeItem").mockImplementation((key) => {
      if (key === `${prefix}${first.operationId}`)
        throw new DOMException("Synthetic cleanup failure", "SecurityError");
      mirror.delete(key);
    });
    expect(await clearOutbox("qa-alice", second.state, second)).toBe(true);
    expect(mirror.has(`${prefix}${first.operationId}`)).toBe(true);
    expect(mirror.has(`${prefix}${second.operationId}`)).toBe(true);
    expect(await readOutbox("qa-alice")).toBeNull();
  });

  it("keeps the queue when neither backend can durably retain the acknowledgement", async () => {
    await queueSync(career(1), "qa-alice");
    const captured = (await readOutbox("qa-alice"))!;
    const storage = window.localStorage;
    vi.spyOn(storage, "setItem").mockImplementation((key, value) => {
      if (key.startsWith(`${scopedCareerKey("career.outbox.ack", "qa-alice")}:generation:`))
        throw new DOMException("Synthetic quota", "QuotaExceededError");
      mirror.set(key, value);
    });
    db.unavailable = true;
    expect(await clearOutbox("qa-alice", captured.state, captured)).toBe(false);
    expect(await readOutbox("qa-alice")).toEqual(captured);
    db.unavailable = false;
    expect(await readOutbox("qa-alice")).toEqual(captured);
  });

  it("acknowledges legacy entries exactly without WebCrypto while keeping owner isolation", async () => {
    vi.stubGlobal("crypto", undefined);
    const legacy = { at: 1000, state: career(1) };
    const key = scopedCareerKey("career.outbox", "qa-alice");
    db.rows.set(key, legacy);
    mirror.set(key, JSON.stringify(legacy));
    db.unavailable = true;
    expect(await clearOutbox("qa-alice", legacy.state, legacy)).toBe(true);
    db.unavailable = false;
    expect(await readOutbox("qa-alice")).toBeNull();
    await queueSync(career(1), "qa-bob");
    expect((await readOutbox("qa-bob"))?.operationId).toMatch(/^[a-f0-9]{32}$/);
  });

  it("does not claim a mirror-only ACK if its legacy fingerprint exceeds the mirror parser limit", async () => {
    vi.stubGlobal("crypto", undefined);
    const large = { ...career(1), syntheticPayload: '"'.repeat(1100000) };
    const legacy = { at: 1000, state: large };
    const key = scopedCareerKey("career.outbox", "qa-alice");
    db.rows.set(key, legacy);
    mirror.set(key, JSON.stringify(legacy));
    db.unavailable = true;
    expect(await clearOutbox("qa-alice", large, legacy)).toBe(false);
    db.unavailable = false;
    expect((await readOutbox("qa-alice"))?.state).toEqual(large);
  });

  it("fails explicitly at the acknowledgement limit without removing confirmations or the new queue", async () => {
    const ackKey = scopedCareerKey("career.outbox.ack", "qa-alice");
    const ack = {
      version: 1,
      at: 1000,
      entries: Array.from({ length: 256 }, (_, index) => ({
        entryAt: index,
        operationId: index.toString(16).padStart(32, "0"),
      })),
    };
    mirror.set(ackKey, JSON.stringify(ack));
    db.rows.set(ackKey, structuredClone(ack));
    await queueSync(career(1), "qa-alice");
    const pending = (await readOutbox("qa-alice"))!;
    db.unavailable = true;
    await expect(clearOutbox("qa-alice", pending.state, pending)).rejects.toThrow(
      /histórico.*cheio/i,
    );
    expect(await readOutbox("qa-alice")).toEqual(pending);
    expect(db.rows.get(ackKey)).toEqual(ack);
    expect(mirror.get(ackKey)).toBe(JSON.stringify(ack));
    db.unavailable = false;
    expect(await clearOutbox("qa-alice", pending.state, pending)).toBe(true);
    expect(await readOutbox("qa-alice")).toBeNull();
  });

  it("continues beyond 256 online enqueue/ack cycles by compacting only after durable canonical null", async () => {
    for (let round = 0; round < 260; round++) {
      await queueSync(career(round), "qa-alice");
      const captured = (await readOutbox("qa-alice"))!;
      expect(await clearOutbox("qa-alice", captured.state, captured)).toBe(true);
      expect(db.rows.get(scopedCareerKey("career.outbox", "qa-alice"))).toBeNull();
      expect(mirror.get(scopedCareerKey("career.outbox", "qa-alice"))).toBe("null");
    }
    const ack = db.rows.get(scopedCareerKey("career.outbox.ack", "qa-alice")) as {
      entries: unknown[];
    };
    expect(ack.entries.length).toBeLessThanOrEqual(1);
  });

  it("does not discard a union larger than the limit when two individually valid ledgers diverge", async () => {
    const ackKey = scopedCareerKey("career.outbox.ack", "qa-alice");
    const entries = Array.from({ length: 257 }, (_, index) => ({
      entryAt: index,
      operationId: index.toString(16).padStart(32, "0"),
    }));
    const stored = { version: 1, at: 1000, entries: entries.slice(0, 256) };
    const mirrored = { version: 1, at: 1000, entries: entries.slice(1) };
    await queueSync(career(1), "qa-alice");
    const captured = (await readOutbox("qa-alice"))!;
    db.rows.set(ackKey, stored);
    mirror.set(ackKey, JSON.stringify(mirrored));
    // A different durable generation prevents the proof needed for compaction.
    db.rows.set(scopedCareerKey("career.outbox", "qa-alice"), {
      at: 1,
      state: career(2),
      operationId: "f".repeat(32),
    });
    await expect(clearOutbox("qa-alice", captured.state, captured)).rejects.toThrow(
      /histórico.*cheio/i,
    );
    expect(db.rows.get(ackKey)).toEqual(stored);
    expect(mirror.get(ackKey)).toBe(JSON.stringify(mirrored));
  });

  it("recovers a valid mirror instead of selecting a corrupt newer IDB record, without writing", async () => {
    await saveLocalCareer(career(1), "qa", "qa-alice");
    db.rows.set(scopedCareerKey("career.state", "qa-alice"), { broken: true });
    db.rows.set(scopedCareerKey("career.savedAt", "qa-alice"), 2000);
    const before = structuredClone(db.rows);
    expect(await loadLocalCareer("qa-alice")).toEqual(career(1));
    expect(db.rows).toEqual(before);
  });

  it("still reads a valid career when an unrelated snapshot record is corrupt", async () => {
    await saveLocalCareer(career(1), "qa", "qa-alice");
    db.rows.set(scopedCareerKey("career.snapshots", "qa-alice"), { corrupt: true });
    await expect(loadLocalCareer("qa-alice")).resolves.toEqual(career(1));
    await expect(exportLocalCareerData("qa-alice")).resolves.toMatchObject({ snapshots: [] });
  });

  it("retains both snapshots when two saves reach the history read together", async () => {
    db.barrierKey = scopedCareerKey("career.snapshots", "qa-alice");
    await Promise.all([
      saveLocalCareer(career(1), "qa one", "qa-alice"),
      saveLocalCareer(career(2), "qa two", "qa-alice"),
    ]);
    const snapshots = (await exportLocalCareerData("qa-alice")).snapshots;
    expect(snapshots.map((copy) => copy.state.round).sort()).toEqual([1, 2]);
  });

  it("retains concurrent pre-migration backups when the mirror is unavailable", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("Synthetic quota", "QuotaExceededError");
        },
      },
    });
    db.barrierKey = scopedCareerKey("career.migration-backups", "qa-alice");
    const results = await Promise.allSettled([
      backupCareerBeforeMigration(career(1), "qa-alice"),
      backupCareerBeforeMigration(career(2), "qa-alice"),
    ]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
    const backups = (await exportLocalCareerData("qa-alice")).migrationBackups;
    expect(backups.map((copy) => copy.state.round).sort()).toEqual([1, 2]);
  });

  it("rejects reset when local deletion cannot complete instead of reporting success", async () => {
    await saveLocalCareer(career(1), "qa", "qa-alice");
    db.unavailable = true;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => mirror.get(key) ?? null,
        removeItem: () => {
          throw new DOMException("Synthetic blocked storage", "SecurityError");
        },
      },
    });
    await expect(clearLocalCareer("qa-alice")).rejects.toThrow();
    expect(await loadLocalCareer("qa-alice")).toEqual(career(1));
  });

  it("does not resurrect account mirrors after an explicit device-wide reset", async () => {
    await saveLocalCareer(career(1), "qa", "qa-alice");
    await saveLocalCareer(career(2), "qa", "qa-bob");
    mirror.set("unrelated.preference", "keep");
    await wipeEverything();
    expect(await loadLocalCareer("qa-alice")).toBeNull();
    expect(await loadLocalCareer("qa-bob")).toBeNull();
    expect(mirror.get("unrelated.preference")).toBe("keep");
  });

  it("removes malformed generation keys only for the explicitly reset owner", async () => {
    const alice = scopedCareerKey("career.outbox.ack", "qa-alice");
    const bob = scopedCareerKey("career.outbox.ack", "qa-bob");
    mirror.set(`${alice}:generation:malformed-token`, "corrupt");
    mirror.set(`${bob}:generation:malformed-token`, "keep");
    await clearLocalCareer("qa-alice");
    expect(mirror.has(`${alice}:generation:malformed-token`)).toBe(false);
    expect(mirror.get(`${bob}:generation:malformed-token`)).toBe("keep");
    mirror.set("career.outbox.ack:generation:malformed-token", "corrupt guest");
    await wipeEverything();
    expect(mirror.has(`${bob}:generation:malformed-token`)).toBe(false);
    expect(mirror.has("career.outbox.ack:generation:malformed-token")).toBe(false);
  });
});
