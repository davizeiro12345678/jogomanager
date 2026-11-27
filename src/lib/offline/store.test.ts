import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CareerState } from "@/game/types";

const { indexed, failDelMany, failSetMany, failSet, failGet, cloneOnRead } = vi.hoisted(() => ({
  indexed: new Map<string, unknown>(),
  failDelMany: { value: false },
  failSetMany: { value: false },
  failSet: { value: false },
  failGet: { value: false },
  cloneOnRead: { value: false },
}));

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (key: string) => {
    if (failGet.value) throw new Error("IndexedDB read failed");
    const value = indexed.get(key);
    return cloneOnRead.value && value !== undefined ? structuredClone(value) : value;
  }),
  getMany: vi.fn(async (keys: string[]) => keys.map((key) => indexed.get(key))),
  set: vi.fn(async (key: string, value: unknown) => {
    if (failSet.value) throw new Error("IndexedDB write failed");
    indexed.set(key, value);
  }),
  setMany: vi.fn(async (entries: [string, unknown][]) => {
    if (failSetMany.value) throw new Error("IndexedDB write failed");
    for (const [key, value] of entries) indexed.set(key, value);
  }),
  update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => {
    indexed.set(key, updater(indexed.get(key)));
  }),
  del: vi.fn(async (key: string) => void indexed.delete(key)),
  delMany: vi.fn(async (keys: string[]) => {
    if (failDelMany.value) throw new Error("IndexedDB delete failed");
    for (const key of keys) indexed.delete(key);
  }),
  clear: vi.fn(async () => void indexed.clear()),
}));

import {
  LEGACY_KEY,
  acknowledgeOutbox,
  clearLocalCareer,
  clearOutbox,
  loadLocalCareer,
  queueSync,
  readLocalCareer,
  readOutbox,
  readCareerEpoch,
  saveLocalCareer,
  markCareerReset,
  markLocalCareerSyncBlock,
  clearLocalCareerSyncBlock,
  clearLocalCareerTombstone,
  markLocalCareerTombstone,
  readLocalCareerSyncBlock,
  withCareerLock,
} from "./store";
import { resetCareerSafely } from "../career-reset";

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

const career = (managerName: string) => ({ managerName }) as CareerState;

describe("offline career owner boundary", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    indexed.clear();
    failDelMany.value = false;
    failSetMany.value = false;
    failSet.value = false;
    failGet.value = false;
    cloneOnRead.value = false;
    storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("navigator", { onLine: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps saves, snapshots and sync outboxes separated for each account", async () => {
    const alice = career("Alice");
    const bruno = career("Bruno");
    await saveLocalCareer(alice, "alice", "alice-id", { generation: 1 });
    await saveLocalCareer(bruno, "bruno", "bruno-id", { generation: 1 });
    await queueSync(alice, "alice-id", { generation: 1 });
    await queueSync(bruno, "bruno-id", { generation: 1 });

    expect(readLocalCareer("alice-id")).toEqual(alice);
    expect(readLocalCareer("bruno-id")).toEqual(bruno);
    expect(await loadLocalCareer("alice-id")).toEqual(alice);
    expect(await readOutbox("alice-id")).toMatchObject({ state: alice });
    expect(await readOutbox("bruno-id")).toMatchObject({ state: bruno });
    expect(await readOutbox()).toBeNull();

    await clearOutbox("alice-id");
    expect(await readOutbox("alice-id")).toBeNull();
    expect(await readOutbox("bruno-id")).toMatchObject({ state: bruno });
  });

  it("treats legacy shared storage as a guest save and never gives it to a signed-in account", async () => {
    const guest = career("Visitante antigo");
    storage.setItem(LEGACY_KEY, JSON.stringify(guest));

    expect(readLocalCareer()).toEqual(guest);
    expect(readLocalCareer("new-account")).toBeNull();
    expect(await loadLocalCareer("new-account")).toBeNull();
    expect(await loadLocalCareer()).toEqual(guest);
  });

  it("recovers an account from its own mirror when IndexedDB becomes unreadable", async () => {
    const saved = career("Offline account");
    await saveLocalCareer(saved, "manual", "alice-id");
    storage.setItem(LEGACY_KEY, JSON.stringify(career("Unrelated guest")));
    failGet.value = true;

    await expect(loadLocalCareer("alice-id")).resolves.toEqual(saved);
    await expect(loadLocalCareer("another-account")).resolves.toBeNull();
  });

  it("ignores scalar persisted saves and recovers only a valid owner mirror", async () => {
    const saved = career("Recovered account");
    await saveLocalCareer(saved, "manual", "alice-id");
    indexed.set("career.v2.account-alice-id.career", "corrupt scalar");
    await expect(loadLocalCareer("alice-id")).resolves.toEqual(saved);
    storage.setItem("manager3d.career.v2.account-another-account", "42");
    expect(readLocalCareer("another-account")).toBeNull();
  });

  it("fails closed when an IndexedDB outbox has a malformed state or timestamp", async () => {
    const key = "career.v2.account-alice-id.outbox";
    indexed.set(key, { at: 1, state: [], generation: 1, revision: "queued-revision" });
    await expect(readOutbox("alice-id")).rejects.toThrow("Career outbox is unreadable");
    indexed.set(key, {
      at: NaN,
      state: career("Alice"),
      generation: 1,
      revision: "queued-revision",
    });
    await expect(readOutbox("alice-id")).rejects.toThrow("Career outbox is unreadable");
    expect(indexed.has(key)).toBe(true);
  });

  it("acknowledges only the uploaded account's queued revision", async () => {
    const alice = await queueSync(career("Alice"), "alice-id", { generation: 1 });
    await queueSync(career("Bruno"), "bruno-id", { generation: 1 });
    await queueSync(career("Guest"));
    expect(alice).not.toBeNull();
    expect(await acknowledgeOutbox(alice, "alice-id")).toBe(true);
    expect(await readOutbox("alice-id")).toBeNull();
    expect(await readOutbox("bruno-id")).toMatchObject({ state: career("Bruno") });
    expect(await readOutbox()).toBeNull();
  });

  it("propagates an idb-keyval.get rejection from readOutbox (Map mock simulation)", async () => {
    // This harness replaces idb-keyval with an in-memory Map; it simulates a
    // rejected get promise and does not exercise a real IndexedDB database.
    failGet.value = true;
    await expect(readOutbox("alice-id")).rejects.toMatchObject({
      message: "Career outbox is unreadable",
      cause: expect.any(Error),
    });
    failGet.value = false;
    await expect(readOutbox("alice-id")).resolves.toBeNull();
  });

  it("keeps a newer queued save when an older upload finishes in the same millisecond", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(123456789);
    try {
      const older = await queueSync(career("Round 1"), "alice-id", { generation: 1 });
      const newer = await queueSync(career("Round 2"), "alice-id", { generation: 1 });
      expect(await acknowledgeOutbox(older, "alice-id")).toBe(false);
      expect(await readOutbox("alice-id")).toEqual(newer);
      expect(await acknowledgeOutbox(newer, "alice-id")).toBe(true);
      expect(await readOutbox("alice-id")).toBeNull();
    } finally {
      now.mockRestore();
    }
  });

  it("fails closed and preserves the mirror when the atomic IDB delete fails", async () => {
    const saved = career("Protegida");
    await saveLocalCareer(saved, "manual", "alice-id");
    failDelMany.value = true;

    await expect(clearLocalCareer("alice-id")).resolves.toBe(false);
    expect(readLocalCareer("alice-id")).toEqual(saved);
    expect(await loadLocalCareer("alice-id")).toEqual(saved);
  });

  it("propagates unreadable outbox and blocks reset without tombstone or wipe", async () => {
    const saved = career("Progresso durável");
    await saveLocalCareer(saved, "manual", "alice-id", { generation: 1 });
    await queueSync(saved, "alice-id", { generation: 1 });
    failGet.value = true;
    await expect(readOutbox("alice-id")).rejects.toThrow("Career outbox is unreadable");

    const wipeRemote = vi.fn(async () => ({ generation: 2, deletedAt: "now" }));
    const persistTombstone = vi.fn(async () => true);
    const clearLocal = vi.fn(async () => true);
    const outcome = await resetCareerSafely({
      status: "ready",
      owner: "alice-id",
      userId: "alice-id",
      getSync: () => "synced",
      isSaving: () => false,
      isOnline: () => true,
      isCurrentOwner: (owner) => owner === "alice-id",
      readOutbox,
      wipeRemote,
      persistTombstone,
      clearLocal,
      withCrossTabLock: async (_owner, callback) => ({ acquired: true, value: await callback() }),
    });

    expect(outcome).toMatchObject({ ok: false, reason: "preflight" });
    expect(wipeRemote).not.toHaveBeenCalled();
    expect(persistTombstone).not.toHaveBeenCalled();
    expect(clearLocal).not.toHaveBeenCalled();
    expect(readLocalCareer("alice-id")).toEqual(saved);
  });

  it("verifies IndexedDB writes against structured clones without relying on object identity", async () => {
    cloneOnRead.value = true;
    vi.stubGlobal("window", {
      localStorage: {
        length: 0,
        clear() {},
        getItem() {
          return null;
        },
        key() {
          return null;
        },
        removeItem() {
          return;
        },
        setItem() {
          throw new Error("localStorage unavailable");
        },
      } as Storage,
    });
    const saved = career("IndexedDB clone");

    await expect(saveLocalCareer(saved, "manual", "idb-only")).resolves.toBe(true);
    await expect(loadLocalCareer("idb-only")).resolves.toEqual(saved);
  });

  it("retains a durable pending barrier when the outbox write fails after the save", async () => {
    const previous = career("Anterior");
    const next = career("Nova");
    await saveLocalCareer(previous, "manual", "alice-id", { generation: 1 });
    const { markLocalCareerSyncBlock } = await import("./store");
    expect(
      await markLocalCareerSyncBlock(
        { reason: "pending_save", generation: 1, blockedAt: "now" },
        "alice-id",
      ),
    ).toBe(true);
    expect(
      await saveLocalCareer(next, "auto", "alice-id", {
        generation: 1,
        allowPendingBarrier: true,
      }),
    ).toBe(true);
    failSet.value = true;
    expect(
      await queueSync(next, "alice-id", { generation: 1, allowPendingBarrier: true }),
    ).toBeNull();
    expect(await readLocalCareerSyncBlock("alice-id")).toMatchObject({ reason: "pending_save" });
    // Even after an offline reload the stale/unsynced snapshot cannot be treated as ready.
    vi.stubGlobal("navigator", { onLine: false });
    expect(await loadLocalCareer("alice-id")).toEqual(next);
  });

  it("returns false when a deleted sync block cannot be removed", async () => {
    await markLocalCareerTombstone({ generation: 2, deletedAt: "now" }, "alice-id");
    const { del } = await import("idb-keyval");
    vi.mocked(del).mockImplementationOnce(async () => {
      throw new Error("delete failed");
    });
    await expect(clearLocalCareerTombstone("alice-id")).resolves.toBe(false);
    expect(await readLocalCareerSyncBlock("alice-id")).toMatchObject({ reason: "deleted" });
  });

  it("serializes an enqueue that starts after reset preflight", async () => {
    let releaseReset!: () => void;
    let preflight!: () => void;
    const resetPreflight = new Promise<void>((resolve) => {
      preflight = resolve;
    });
    const resetRelease = new Promise<void>((resolve) => {
      releaseReset = resolve;
    });
    const queue = new Map<string, Promise<void>>();
    vi.stubGlobal("navigator", {
      onLine: true,
      locks: {
        request: async (_name: string, _options: LockOptions, callback: () => Promise<void>) => {
          const previous = queue.get("career");
          const current = (previous ?? Promise.resolve()).then(callback);
          queue.set(
            "career",
            current.catch(() => undefined),
          );
          return current;
        },
      },
    });

    const reset = withCareerLock("alice-id", async () => {
      preflight();
      await resetRelease;
      expect(markCareerReset("alice-id")).toBe(true);
      return clearLocalCareer("alice-id", { lockHeld: true });
    });
    await resetPreflight;
    const afterPreflight = queueSync(career("Depois"), "alice-id");
    releaseReset();

    await expect(reset).resolves.toMatchObject({ acquired: true, value: true });
    await expect(afterPreflight).resolves.toBeNull();
    expect(await readOutbox("alice-id")).toBeNull();
  });

  it("waits for an in-flight guest save before clearing through the same lock", async () => {
    let releaseWrite!: () => void;
    let writeStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      writeStarted = resolve;
    });
    const delayedWrite = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const lockTails = new Map<string, Promise<unknown>>();
    const lockNames: string[] = [];
    vi.stubGlobal("navigator", {
      onLine: true,
      locks: {
        request: async (name: string, _options: LockOptions, callback: () => Promise<unknown>) => {
          lockNames.push(name);
          const current = (lockTails.get(name) ?? Promise.resolve()).then(callback);
          lockTails.set(
            name,
            current.catch(() => undefined),
          );
          return current;
        },
      },
    });
    const { setMany } = await import("idb-keyval");
    vi.mocked(setMany).mockImplementationOnce(async (entries) => {
      writeStarted();
      await delayedWrite;
      for (const [key, value] of entries) indexed.set(String(key), value);
    });

    const saved = career("Save concorrente");
    const save = saveLocalCareer(saved, "manual", null);
    await started;
    const clearLocal = vi.fn(async (owner: string | null) =>
      clearLocalCareer(owner, { lockHeld: true }),
    );
    const reset = resetCareerSafely({
      status: "ready",
      owner: null,
      userId: null,
      getSync: () => "local",
      isSaving: () => false,
      isOnline: () => false,
      isCurrentOwner: (owner) => owner === null,
      readOutbox,
      wipeRemote: vi.fn(async () => null),
      clearLocal,
      beginReset: markCareerReset,
      withCrossTabLock: withCareerLock,
    });

    await Promise.resolve();
    expect(clearLocal).not.toHaveBeenCalled();
    releaseWrite();
    await expect(save).resolves.toBe(true);
    await expect(reset).resolves.toEqual({ ok: true });
    expect(lockNames).toHaveLength(2);
    expect(new Set(lockNames).size).toBe(1);
    expect(clearLocal).toHaveBeenCalledTimes(1);
    expect(readLocalCareer()).toBeNull();
    await expect(loadLocalCareer()).resolves.toBeNull();
  });

  it("rejects a save from a career epoch captured before reset, even when called after the mark", async () => {
    const staleEpoch = 0;
    expect(markCareerReset("alice-id")).toBe(true);
    const { setMany, set } = await import("idb-keyval");
    const beforeIdbWrites = vi.mocked(setMany).mock.calls.length + vi.mocked(set).mock.calls.length;

    await expect(
      saveLocalCareer(career("Stale"), "stale", "alice-id", { expectedEpoch: staleEpoch }),
    ).resolves.toBe(false);

    expect(vi.mocked(setMany).mock.calls.length + vi.mocked(set).mock.calls.length).toBe(
      beforeIdbWrites,
    );
    expect(readLocalCareer("alice-id")).toBeNull();
    expect(storage.getItem("manager3d.career.v2.account-alice-id")).toBeNull();
  });

  it("fences sync-block writes and clears with their originating epoch", async () => {
    const staleEpoch = readCareerEpoch("alice-id") ?? 0;
    expect(staleEpoch).toBe(0);
    expect(markCareerReset("alice-id")).toBe(true);

    await expect(
      markLocalCareerSyncBlock(
        { reason: "pending_save", generation: 1, blockedAt: "stale" },
        "alice-id",
        { expectedEpoch: staleEpoch },
      ),
    ).resolves.toBe(false);
    expect(await readLocalCareerSyncBlock("alice-id")).toBeNull();

    expect(
      await markLocalCareerSyncBlock(
        { reason: "deleted", generation: 2, deletedAt: "now", blockedAt: "now" },
        "alice-id",
        { expectedEpoch: 1 },
      ),
    ).toBe(true);
    await expect(
      clearLocalCareerSyncBlock("alice-id", { expectedEpoch: staleEpoch }),
    ).resolves.toBe(false);
    expect(await readLocalCareerSyncBlock("alice-id")).toMatchObject({ reason: "deleted" });
  });

  it("does not persist a legacy migration that finishes after a reset mark", async () => {
    const legacy = career("Legacy read before reset");
    let releaseLegacyRead!: () => void;
    let legacyReadStarted!: () => void;
    const legacyRead = new Promise<void>((resolve) => {
      releaseLegacyRead = resolve;
    });
    const started = new Promise<void>((resolve) => {
      legacyReadStarted = resolve;
    });
    const { get } = await import("idb-keyval");
    const getMock = vi.mocked(get);
    const originalGet = getMock.getMockImplementation();
    getMock.mockImplementation(async (key) => {
      if (key === "career.v2.guest.career.state") return undefined;
      if (key === "career.state") {
        legacyReadStarted();
        await legacyRead;
        return legacy;
      }
      return indexed.get(String(key));
    });

    try {
      const hydration = loadLocalCareer();
      await started;
      expect(markCareerReset()).toBe(true);
      expect(await clearLocalCareer()).toBe(true);
      releaseLegacyRead();

      await expect(hydration).resolves.toEqual(legacy);
      expect(readLocalCareer()).toBeNull();
      if (originalGet) getMock.mockImplementation(originalGet);
      else getMock.mockReset();
      expect(await loadLocalCareer()).toBeNull();
    } finally {
      if (originalGet) getMock.mockImplementation(originalGet);
      else getMock.mockReset();
    }
  });

  it("turns unknown and malformed persisted sync blocks into a fail-closed barrier", async () => {
    const { set } = await import("idb-keyval");
    const key = "career.v2.account-alice-id.syncBlock";
    await vi.mocked(set)(key, {
      reason: "future_reason",
      generation: null,
      blockedAt: "2026-11-08T00:00:00.000Z",
    });
    const future = await readLocalCareerSyncBlock("alice-id");
    expect(future).not.toBeNull();
    expect(future?.reason).toBe("unknown");
    expect(future?.generation).toBeNull();

    await vi.mocked(set)(key, { reason: "pending_save", generation: -1, blockedAt: "" });
    const malformed = await readLocalCareerSyncBlock("alice-id");
    expect(malformed).not.toBeNull();
    expect(malformed?.reason).toBe("unknown");

    storage.setItem("manager3d.career.v2.account-alice-id.sync-block", "{");
    indexed.delete(key);
    const invalidJson = await readLocalCareerSyncBlock("alice-id");
    expect(invalidJson).not.toBeNull();
    expect(invalidJson?.reason).toBe("unknown");
  });
});
