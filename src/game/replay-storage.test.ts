import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const archive = vi.hoisted(() => new Map<string, unknown>());
vi.mock("idb-keyval", () => ({
  get: async (key: string) => archive.get(key),
  keys: async () => [...archive.keys()],
  del: async (key: string) => {
    archive.delete(key);
  },
  promisifyRequest: () => new Promise((resolve) => queueMicrotask(() => resolve(undefined))),
  createStore: () => async (_mode: string, callback: (store: unknown) => Promise<unknown>) =>
    callback({
      transaction: {},
      get: (key: string) => {
        const request = {
          result: archive.get(key),
          onsuccess: undefined as undefined | (() => void),
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
      put: (value: unknown, key: string) => archive.set(key, value),
      delete: (key: string) => archive.delete(key),
    }),
}));
import {
  clearReplayArchive,
  exportReplayArchive,
  listReplaySummaries,
  loadReplay,
  removeReplayEntry,
  storeReplayEntry,
} from "./replay-storage";
import { buildTeamSetup } from "./quickMatch";
import type { Replay } from "./replay";
import { encodeReplay, encodeStoredReplay } from "./replay-codec";
const fixture = (title: string): Replay => ({
  id: "same-id",
  title,
  createdAt: 1,
  home: buildTeamSetup("fla"),
  away: buildTeamSetup("pal"),
  meta: [
    {
      id: "fixture-player",
      side: "home",
      name: "Atleta",
      number: 1,
      pos: "GK",
      pid: "fixture-player",
    },
  ],
  frames: [],
  score: [0, 0],
});

beforeEach(() => {
  archive.clear();
  vi.stubGlobal("window", {});
});
afterEach(() => vi.unstubAllGlobals());
describe("owner scoped replay archives", () => {
  it("preserves an empty authoritative v3 archive instead of resurrecting deleted v2 replays", async () => {
    archive.set("manager3d.replays.v2", [fixture("deleted")]);
    archive.set("manager3d.replays.v3", []);
    expect(await listReplaySummaries()).toEqual([]);
    expect(await loadReplay("same-id")).toBeUndefined();
    await storeReplayEntry({ ...fixture("new"), id: "new-id" });
    expect((await listReplaySummaries()).map((row) => row.id)).toEqual(["new-id"]);
  });
  it("preserves v3 retention decisions when older v2 records are absent from the current archive", async () => {
    archive.set("manager3d.replays.v2", [fixture("evicted")]);
    archive.set("manager3d.replays.v3", [
      encodeReplay({ ...fixture("retained"), id: "retained-id" }),
    ]);
    expect((await listReplaySummaries()).map((row) => row.id)).toEqual(["retained-id"]);
  });
  it("keeps healthy guest replays usable when a legacy archive also contains a corrupt entry", async () => {
    const healthy = encodeReplay(fixture("readable"));
    const originals = [{ version: 3, id: "corrupt", frames: { timesMs: [] } }, healthy];
    archive.set("manager3d.replays.v3", originals);
    expect((await listReplaySummaries()).map((row) => row.id)).toEqual(["same-id"]);
    expect((await loadReplay("same-id"))?.title).toBe("readable");
    expect(archive.get("manager3d.replays.v3")).toBe(originals);
    await storeReplayEntry({ ...fixture("new"), id: "new-id" });
    expect((await listReplaySummaries()).map((row) => row.id)).toEqual(["new-id", "same-id"]);
    await removeReplayEntry("same-id");
    expect((await listReplaySummaries()).map((row) => row.id)).toEqual(["new-id"]);
    expect(archive.get("manager3d.replays.v3")).toBe(originals);
  });
  it("migrates a completed revision-2 packed replay and permits a subsequent new recording", async () => {
    const packed = encodeReplay(fixture("historical physics"));
    archive.set("manager3d.replays.v3", [
      { ...packed, execution: { revision: 2, physics: "rapier", perception: "wasm" } },
    ]);
    expect((await loadReplay("same-id"))?.execution?.revision).toBe(2);
    await storeReplayEntry({ ...fixture("new recording"), id: "new-id" });
    expect(await listReplaySummaries()).toHaveLength(2);
  });
  it("retains the main packed v3 guest archive and clears its recovery copy", async () => {
    const packed = [encodeStoredReplay(fixture("main packed archive"))];
    archive.set("manager3d.replays.v3", packed);
    expect(await listReplaySummaries("A")).toEqual([]);
    expect((await loadReplay("same-id"))?.title).toBe("main packed archive");
    expect(archive.get("manager3d.replays.v3")).toBe(packed);
    expect(await clearReplayArchive()).toBe(true);
    expect(archive.has("manager3d.replays.v3")).toBe(false);
    expect(await listReplaySummaries()).toEqual([]);
  });
  it("isolates listing, loading, writes, deletion, export and clearing for A/B/guest", async () => {
    for (const owner of [null, "A", "B"] as const)
      await storeReplayEntry(fixture(owner ?? "guest"), owner);
    for (const owner of [null, "A", "B"] as const) {
      expect((await listReplaySummaries(owner)).map((row) => row.title)).toEqual([
        owner ?? "guest",
      ]);
      expect((await loadReplay("same-id", owner))?.title).toBe(owner ?? "guest");
      const exported = await exportReplayArchive(owner);
      expect(
        Object.values(exported).some((value) => (value as Replay)?.title === (owner ?? "guest")),
      ).toBe(true);
      expect(
        Object.keys(exported).some((key) =>
          owner === null ? key.includes("owner.v1") : !key.includes(`user:${owner}:`),
        ),
      ).toBe(false);
    }
    await removeReplayEntry("same-id", "A");
    expect(await loadReplay("same-id", "A")).toBeUndefined();
    expect((await loadReplay("same-id", "B"))?.title).toBe("B");
    expect(await clearReplayArchive("B")).toBe(true);
    expect(await exportReplayArchive("B")).toEqual({});
    expect((await loadReplay("same-id"))?.title).toBe("guest");
    await clearReplayArchive();
    expect(await listReplaySummaries()).toEqual([]);
  });
  it("keeps originals guest only, never imports them on login, and distinguishes encoded account prefixes", async () => {
    const original = [fixture("historical guest")];
    archive.set("manager3d.replays.v2", original);
    expect(await listReplaySummaries("A")).toEqual([]);
    expect(await loadReplay("same-id", "A")).toBeUndefined();
    expect(await exportReplayArchive("A")).toEqual({});
    expect((await listReplaySummaries())[0]?.title).toBe("historical guest");
    expect(archive.get("manager3d.replays.v2")).toBe(original);
    await storeReplayEntry(fixture("colon owner"), "A:entry");
    await storeReplayEntry(fixture("A"), "A");
    await clearReplayArchive("A");
    expect((await loadReplay("same-id", "A:entry"))?.title).toBe("colon owner");
    await clearReplayArchive();
    expect((await loadReplay("same-id", "A:entry"))?.title).toBe("colon owner");
  });
});
