import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerState } from "@/game/types";
const db = vi.hoisted(() => ({ rows: new Map<string, unknown>(), fail: false }));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => {
    if (db.fail) throw new Error("unavailable");
    return db.rows.get(key);
  },
  getMany: async (keys: string[]) => {
    if (db.fail) throw new Error("unavailable");
    return keys.map((key) => db.rows.get(key));
  },
  set: async (key: string, value: unknown) => {
    if (db.fail) throw new Error("quota");
    db.rows.set(key, structuredClone(value));
  },
  setMany: async (entries: [string, unknown][]) => {
    if (db.fail) throw new Error("quota");
    for (const [key, value] of entries) db.rows.set(key, structuredClone(value));
  },
  update: async (key: string, updater: (value: unknown) => unknown) => {
    if (db.fail) throw new Error("quota");
    db.rows.set(key, structuredClone(updater(db.rows.get(key))));
  },
  del: async (key: string) => {
    if (db.fail) throw new Error("quota");
    db.rows.delete(key);
  },
  clear: async () => db.rows.clear(),
}));
import { flushCareerSync } from "./sync";
import {
  clearLocalCareer,
  exportLocalCareerData,
  loadLocalCareer,
  queueSync,
  readOutbox,
  saveLocalCareer,
} from "./store";
const career = (round: number) =>
  ({
    version: 3,
    clubId: "fla",
    leagueId: "bra1",
    managerName: "Sync",
    season: 1,
    round,
  }) as CareerState;
beforeEach(() => {
  db.rows.clear();
  db.fail = false;
  const mirror = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
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
const assertOwner = async () => {};
describe("owner-serialized career uploads", () => {
  it("rechecks durable progress after a deferred migration before sending anything", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const began = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const uploaded: number[] = [];
    const pending = flushCareerSync("alice", {
      assertOwner,
      prepare: async (state) => {
        if (state.round === 1) {
          entered();
          await gate;
        }
        return state;
      },
      upload: async (state) => {
        uploaded.push(state.round);
      },
    });
    await began;
    await saveLocalCareer(career(2), "auto", "alice");
    await queueSync(career(2), "alice");
    release();
    const result = await pending;
    expect(uploaded).toEqual([2]);
    expect(result.synced).toBe(true);
    expect((await loadLocalCareer("alice"))?.round).toBe(2);
    expect(await readOutbox("alice")).toBeNull();
  });
  it("does not persist a migration after the owner changes while its code loads", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    let activeOwner = "alice";
    const uploaded: number[] = [];
    await expect(
      flushCareerSync("alice", {
        assertOwner: async () => {
          if (activeOwner !== "alice") throw new Error("Conta mudou");
        },
        prepare: async (state) => {
          await Promise.resolve();
          activeOwner = "bob";
          return state.round === 1 ? career(2) : state;
        },
        upload: async (state) => {
          uploaded.push(state.round);
        },
      }),
    ).rejects.toThrow("Conta mudou");
    expect(uploaded).toEqual([]);
    expect((await loadLocalCareer("alice"))?.round).toBe(1);
    expect((await readOutbox("alice"))?.state.round).toBe(1);
    expect((await exportLocalCareerData("alice")).migrationBackups).toEqual([]);
    expect(await loadLocalCareer("bob")).toBeNull();
  });
  it("retains recoverable state and queue when migration loading fails", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    const upload = vi.fn();
    await expect(
      flushCareerSync("alice", {
        assertOwner,
        prepare: async () => {
          throw new Error("Migration unavailable offline");
        },
        upload,
      }),
    ).rejects.toThrow("Migration unavailable offline");
    expect(upload).not.toHaveBeenCalled();
    expect((await loadLocalCareer("alice"))?.round).toBe(1);
    expect((await readOutbox("alice"))?.state.round).toBe(1);
  });
  it("does not resurrect a career deleted while migration code is loading", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    const upload = vi.fn();
    const result = await flushCareerSync("alice", {
      assertOwner,
      prepare: async () => {
        await clearLocalCareer("alice");
        return career(2);
      },
      upload,
    });
    expect(upload).not.toHaveBeenCalled();
    expect(result).toEqual({ state: null, synced: true });
    expect(await loadLocalCareer("alice")).toBeNull();
    expect(await readOutbox("alice")).toBeNull();
  });
  it("retains the raw recovery copy before persisting or uploading a migrated state", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    const uploaded: number[] = [];
    await flushCareerSync("alice", {
      assertOwner,
      prepare: (state) => (state.round === 1 ? career(2) : state),
      upload: async (state) => {
        const saved = await exportLocalCareerData("alice");
        expect(saved.migrationBackups[0]?.state.round).toBe(1);
        expect(saved.career?.round).toBe(2);
        uploaded.push(state.round);
      },
    });
    expect(uploaded).toEqual([2]);
  });
  it("keeps pending progress without uploading after the authenticated owner changes", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    const uploaded: number[] = [];
    await expect(
      flushCareerSync("alice", {
        assertOwner: async () => {
          throw new Error("Conta mudou");
        },
        upload: async (state) => {
          uploaded.push(state.round);
        },
      }),
    ).rejects.toThrow("Conta mudou");
    expect(uploaded).toEqual([]);
    expect((await readOutbox("alice"))?.state.round).toBe(1);
  });
  it("never uploads old offline A after current online B", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    await saveLocalCareer(career(2), "auto", "alice");
    const uploaded: number[] = [];
    const options = {
      assertOwner,
      upload: async (state: CareerState) => {
        uploaded.push(state.round);
      },
    };
    await flushCareerSync("alice", options);
    await flushCareerSync("alice", options);
    expect(uploaded).toEqual([2]);
    expect(await readOutbox("alice")).toBeNull();
  });
  it("serializes overlapping hook uploads and finishes with B after in-flight A", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const began = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const uploaded: number[] = [];
    const options = {
      assertOwner,
      upload: async (state: CareerState) => {
        uploaded.push(state.round);
        if (state.round === 1) {
          entered();
          await gate;
        }
      },
    };
    const first = flushCareerSync("alice", options);
    await began;
    await saveLocalCareer(career(2), "auto", "alice");
    await queueSync(career(2), "alice");
    const second = flushCareerSync("alice", options);
    release();
    await Promise.all([first, second]);
    expect(uploaded).toEqual([1, 2]);
    expect(await readOutbox("alice")).toBeNull();
  });
  it("retains newer queued C while an older upload is acknowledged", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    const result = await flushCareerSync("alice", {
      assertOwner,
      upload: async () => {
        await saveLocalCareer(career(3), "auto", "alice");
        await queueSync(career(3), "alice");
      },
    });
    expect(result.synced).toBe(false);
    expect((await readOutbox("alice"))?.state.round).toBe(3);
  });
  it("does not upload stale A when replacement queue persistence fails", async () => {
    await saveLocalCareer(career(1), "auto", "alice");
    await queueSync(career(1), "alice");
    await saveLocalCareer(career(2), "auto", "alice");
    db.fail = true;
    const values = new Map<string, string>([
      ["manager3d.career.v1:user:alice", JSON.stringify(career(2))],
      ["career.outbox:user:alice", JSON.stringify({ at: 1, state: career(1) })],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    const uploaded: number[] = [];
    await expect(
      flushCareerSync("alice", {
        assertOwner,
        upload: async (state) => {
          uploaded.push(state.round);
        },
      }),
    ).rejects.toThrow();
    expect(uploaded).toEqual([]);
    expect((await loadLocalCareer("alice"))?.round).toBe(2);
  });
});
