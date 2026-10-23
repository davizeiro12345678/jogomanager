import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerState } from "@/game/types";
const storage = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  get: async (key: string) => storage.get(key),
  set: async (key: string, value: unknown) => {
    storage.set(key, value);
  },
  setMany: async (entries: [string, unknown][]) => {
    for (const [key, value] of entries) storage.set(key, structuredClone(value));
  },
  getMany: async (keys: string[]) => keys.map((key) => storage.get(key)),
  update: async (key: string, updater: (value: unknown) => unknown) => {
    storage.set(key, structuredClone(updater(storage.get(key))));
  },
  del: async (key: string) => {
    storage.delete(key);
  },
  clear: async () => storage.clear(),
}));
import {
  saveLocalCareer,
  loadLocalCareer,
  queueSync,
  readOutbox,
  clearLocalCareerData,
  listSnapshots,
  clearOutbox,
  backupCareerBeforeMigration,
  exportLocalCareerData,
} from "./store";
const career = (name: string): CareerState =>
  ({ clubId: "fla", leagueId: "bra1", managerName: name, version: 1 }) as unknown as CareerState;
beforeEach(() => {
  storage.clear();
  const mirror = new Map();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => mirror.get(key),
      setItem: (key: string, value: string) => mirror.set(key, value),
      removeItem: (key: string) => mirror.delete(key),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("account-scoped career storage", () => {
  it("keeps historical outbox A exportable without replaying it after current B is acknowledged", async () => {
    storage.set("career.v2.account-alice.career", career("A"));
    storage.set("career.v2.account-alice.outbox", { at: 200, state: career("A") });
    expect((await loadLocalCareer("alice"))?.managerName).toBe("A");
    await saveLocalCareer(career("B"), "auto", "alice");
    await queueSync(career("B"), "alice");
    await clearOutbox("alice", career("B"));
    expect((await loadLocalCareer("alice"))?.managerName).toBe("B");
    expect(await readOutbox("alice")).toBeNull();
    expect(
      (await exportLocalCareerData("alice")).previousLayout?.pendingSync?.state.managerName,
    ).toBe("A");
  });
  it("recovers only the requested prior v2 account compartment and its unsynced progress", async () => {
    storage.set("career.v2.account-alice.career", { ...career("Alice legacy"), round: 4 });
    storage.set("career.v2.account-alice.savedAt", 100);
    storage.set("career.v2.account-alice.outbox", {
      at: 200,
      state: { ...career("Alice pending"), round: 5 },
    });
    storage.set("career.v2.account-alice.snapshots", [
      { at: 90, label: "auto", state: career("Alice old") },
    ]);
    storage.set("career.v2.account-bob.career", career("Bob legacy"));
    const before = structuredClone(storage);
    const exported = await exportLocalCareerData("alice");
    expect(exported.career?.managerName).toBe("Alice pending");
    expect(exported.savedAt).toBe(200);
    expect(exported.snapshots[0]?.state.managerName).toBe("Alice old");
    expect(exported.pendingSync?.state.managerName).toBe("Alice pending");
    expect(storage).toEqual(before);
    expect((await loadLocalCareer("alice"))?.managerName).toBe("Alice pending");
    expect((await loadLocalCareer("bob"))?.managerName).toBe("Bob legacy");
    expect(await loadLocalCareer("new-account")).toBeNull();
    expect(await loadLocalCareer()).toBeNull();
  });
  it("reads the prior account mirror without adopting a guest or another account mirror", async () => {
    window.localStorage.setItem(
      "manager3d.career.v2.account-alice",
      JSON.stringify(career("Alice mirror")),
    );
    window.localStorage.setItem(
      "manager3d.career.v2.guest",
      JSON.stringify(career("Guest mirror")),
    );
    expect((await loadLocalCareer("alice"))?.managerName).toBe("Alice mirror");
    expect(await loadLocalCareer("bob")).toBeNull();
    expect((await loadLocalCareer())?.managerName).toBe("Guest mirror");
  });
  it("keeps a newer queued state when an older upload is acknowledged", async () => {
    const older = career("Alice round 1");
    const newer = career("Alice round 2");
    await queueSync(older, "alice");
    await queueSync(newer, "alice");
    await queueSync(career("Bob"), "bob");
    await clearOutbox("alice", older);
    expect((await readOutbox("alice"))?.state).toEqual(newer);
    await clearOutbox("alice", structuredClone(newer));
    expect(await readOutbox("alice")).toBeNull();
    expect((await readOutbox("bob"))?.state.managerName).toBe("Bob");
  });
  it("exports and clears recovery copies only for the selected owner", async () => {
    await backupCareerBeforeMigration(career("Alice"), "alice");
    await backupCareerBeforeMigration(career("Bob"), "bob");
    expect((await exportLocalCareerData("alice")).migrationBackups[0]?.state.managerName).toBe(
      "Alice",
    );
    await clearLocalCareerData("alice");
    expect((await exportLocalCareerData("alice")).migrationBackups).toEqual([]);
    expect((await exportLocalCareerData("bob")).migrationBackups[0]?.state.managerName).toBe("Bob");
  });
  it("keeps guest and two account careers, snapshots and queued uploads separate", async () => {
    await saveLocalCareer(career("Guest"));
    await saveLocalCareer(career("Alice"), "auto", "alice");
    await saveLocalCareer(career("Bob"), "auto", "bob");
    await queueSync(career("Alice"), "alice");
    expect((await loadLocalCareer())?.managerName).toBe("Guest");
    expect((await loadLocalCareer("alice"))?.managerName).toBe("Alice");
    expect((await loadLocalCareer("bob"))?.managerName).toBe("Bob");
    expect(await readOutbox("bob")).toBeNull();
    expect((await readOutbox("alice"))?.state.managerName).toBe("Alice");
    expect((await listSnapshots("bob"))[0]?.state.managerName).toBe("Bob");
    await clearLocalCareerData("alice");
    expect(await loadLocalCareer("alice")).toBeNull();
    expect(await readOutbox("alice")).toBeNull();
    expect((await loadLocalCareer("bob"))?.managerName).toBe("Bob");
    expect((await loadLocalCareer())?.managerName).toBe("Guest");
  });
  it("never adopts the legacy guest save or outbox on a new login", async () => {
    await saveLocalCareer(career("Legacy"));
    await queueSync(career("Legacy"));
    expect(await loadLocalCareer("new-account")).toBeNull();
    expect(await readOutbox("new-account")).toBeNull();
    expect((await loadLocalCareer())?.managerName).toBe("Legacy");
  });
});
