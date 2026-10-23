import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CareerState } from "@/game/types";

const db = vi.hoisted(() => ({
  rows: new Map<string, unknown>(),
  fail: false,
  discard: false,
  failAtKey: "",
}));
vi.mock("idb-keyval", () => ({
  get: async (key: string) => {
    if (db.fail) throw new Error("unavailable");
    return db.rows.get(key);
  },
  set: async (key: string, value: unknown) => {
    if (db.fail || db.failAtKey === key) throw new Error("quota");
    if (!db.discard) db.rows.set(key, structuredClone(value));
  },
  setMany: async (entries: [string, unknown][]) => {
    if (db.fail || entries.some(([key]) => key === db.failAtKey)) throw new Error("quota");
    if (!db.discard) for (const [key, value] of entries) db.rows.set(key, structuredClone(value));
  },
  getMany: async (keys: string[]) => {
    if (db.fail) throw new Error("unavailable");
    return keys.map((key) => db.rows.get(key));
  },
  update: async (key: string, updater: (value: unknown) => unknown) => {
    if (db.fail) throw new Error("quota");
    if (!db.discard) db.rows.set(key, structuredClone(updater(db.rows.get(key))));
  },
  del: async (key: string) => {
    db.rows.delete(key);
  },
  clear: async () => db.rows.clear(),
}));
import {
  backupCareerBeforeMigration,
  clearLocalCareerData,
  exportLocalCareerData,
  loadLocalCareer,
  localSavedAt,
  readLocalCareer,
  saveLocalCareer,
  scopedCareerKey,
} from "./store";

const career = {
  version: 3,
  clubId: "fla",
  leagueId: "bra1",
  managerName: "Backup",
  season: 2,
  round: 8,
} as CareerState;
let mirror: Map<string, string>;
beforeEach(() => {
  db.rows.clear();
  db.fail = false;
  db.discard = false;
  db.failAtKey = "";
  mirror = new Map();
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

describe("verified local persistence", () => {
  it("reconciles the parent's newer v2 guest save before reusing unscoped IDB keys", async () => {
    const stale = { ...career, round: 2 };
    const recent = { ...career, round: 12 };
    db.rows.set("career.state", stale);
    db.rows.set("career.savedAt", 100);
    db.rows.set("career.v2.guest.career", recent);
    db.rows.set("career.v2.guest.savedAt", 200);
    mirror.set("manager3d.career.v1", JSON.stringify(recent));
    mirror.set("manager3d.career.v2.guest", JSON.stringify(recent));
    expect((await loadLocalCareer())?.round).toBe(12);
    expect((await exportLocalCareerData()).savedAt).toBe(200);
    expect(db.rows.get("career.state")).toEqual(stale);
    expect(db.rows.get("career.v2.guest.career")).toEqual(recent);
    expect(await loadLocalCareer("other-account")).toBeNull();
  });
  it("prefers the historical scoped guest mirror until a current-layout mirror write is confirmed", () => {
    mirror.set("manager3d.career.v1", JSON.stringify({ ...career, round: 2 }));
    mirror.set("manager3d.career.v2.guest", JSON.stringify({ ...career, round: 12 }));
    expect(readLocalCareer()?.round).toBe(12);
  });
  it("keeps an explicitly confirmed IDB write ahead of a previous-layout clock from the future", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    db.rows.set("career.v2.guest.career", { ...career, round: 12 });
    db.rows.set("career.v2.guest.savedAt", 5000);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    await saveLocalCareer({ ...career, round: 3 });
    expect((await loadLocalCareer())?.round).toBe(3);
  });
  it("does not restore an older IDB career when a newer fallback save shares its clock millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    await saveLocalCareer(career, "auto", "alice");
    db.fail = true;
    await saveLocalCareer({ ...career, round: 9 }, "auto", "alice");
    db.fail = false;
    expect((await loadLocalCareer("alice"))?.round).toBe(9);
  });
  it("reports incomplete privacy deletion when the browser retains a recovery mirror", async () => {
    await backupCareerBeforeMigration(career, "alice");
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => mirror.get(key) ?? null,
        removeItem: () => undefined,
      },
    });
    await expect(clearLocalCareerData("alice")).resolves.toBe(false);
    expect((await exportLocalCareerData("alice")).migrationBackups).toHaveLength(1);
  });
  it("keeps the previous state when the state-and-timestamp transaction cannot commit", async () => {
    await saveLocalCareer(career, "auto", "alice");
    const stateKey = scopedCareerKey("career.state", "alice");
    const timeKey = scopedCareerKey("career.savedAt", "alice");
    const priorTime = db.rows.get(timeKey);
    db.failAtKey = timeKey;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    await expect(saveLocalCareer({ ...career, round: 9 }, "auto", "alice")).rejects.toThrow();
    expect(db.rows.get(stateKey)).toEqual(career);
    expect(db.rows.get(timeKey)).toBe(priorTime);
  });
  it("merges mirror-only migration backups after IndexedDB becomes available again", async () => {
    db.fail = true;
    await backupCareerBeforeMigration(career, "alice");
    db.fail = false;
    await backupCareerBeforeMigration({ ...career, round: 9 }, "alice");
    const exported = await exportLocalCareerData("alice");
    expect(exported.migrationBackups.map((copy) => copy.state.round)).toEqual([9, 8]);
  });
  it("exports the newest fallback save and recovery copies without modifying either store", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    await saveLocalCareer(career, "auto", "alice");
    db.fail = true;
    vi.spyOn(Date, "now").mockReturnValue(2000);
    await saveLocalCareer({ ...career, round: 9 }, "auto", "alice");
    await backupCareerBeforeMigration(career, "alice");
    db.fail = false;
    const beforeDb = structuredClone(db.rows);
    const beforeMirror = new Map(mirror);
    const exported = await exportLocalCareerData("alice");
    expect(exported.career?.round).toBe(9);
    expect(exported.savedAt).toBe(2000);
    expect(exported.migrationBackups[0]?.state.round).toBe(8);
    expect(db.rows).toEqual(beforeDb);
    expect(mirror).toEqual(beforeMirror);
  });
  it("exports available fallback data when IndexedDB rejects reads", async () => {
    db.fail = true;
    await saveLocalCareer(career, "auto", "alice");
    await backupCareerBeforeMigration(career, "alice");
    const exported = await exportLocalCareerData("alice");
    expect(exported.career).toEqual(career);
    expect(exported.migrationBackups).toHaveLength(1);
    expect(exported.pendingSync).toBeNull();
  });
  it("rejects a save when both stores silently discard writes", async () => {
    db.discard = true;
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => undefined } });
    await expect(saveLocalCareer(career)).rejects.toThrow(/salvar|grav|armazenamento/i);
  });
  it("keeps a recoverable timestamp when IndexedDB is unavailable", async () => {
    db.fail = true;
    await saveLocalCareer(career, "importação", "alice");
    expect(await loadLocalCareer("alice")).toEqual(career);
    expect(await localSavedAt("alice")).toBeGreaterThan(0);
    expect(await loadLocalCareer("bob")).toBeNull();
  });
  it("retains a verified pre-migration copy beyond rotating autosaves", async () => {
    await backupCareerBeforeMigration(career, "alice");
    for (let round = 9; round < 21; round++)
      await saveLocalCareer({ ...career, round }, "auto", "alice");
    expect(
      [...db.rows.entries()].some(
        ([key, value]) => key.includes("migration") && JSON.stringify(value).includes('"round":8'),
      ),
    ).toBe(true);
    expect(
      [...db.rows.keys()]
        .filter((key) => key.includes("migration"))
        .every((key) => key.includes("alice")),
    ).toBe(true);
  });
  it("blocks migration if its recovery copy cannot be read back", async () => {
    db.discard = true;
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => undefined } });
    await expect(backupCareerBeforeMigration(career, "alice")).rejects.toThrow(
      /backup|cópia|armazenamento/i,
    );
  });
});
