import { afterEach, expect, it, vi } from "vitest";
import { clearLocalData, exportLocalData } from "./local-data-controls";

vi.mock("@/lib/offline/store", () => ({
  exportLocalCareerData: async () => ({}),
  clearLocalCareerData: async () => true,
}));
vi.mock("@/game/replay-storage", () => ({
  exportReplayArchive: async () => ({}),
  clearReplayArchive: async () => true,
}));
vi.mock("@/game/audio-cache", () => ({ clearVoiceCache: async () => true }));
afterEach(() => vi.unstubAllGlobals());
function storage() {
  const entries = new Map([
    ["manager3d.career.v1", '{"season":2026}'],
    ["pfm3d.lang", "pt-BR"],
    ["manager3d.career.v1:user:another-owner", "private-other-player"],
    ["sb-project-auth-token", "private-session"],
  ]);
  vi.stubGlobal("window", {
    localStorage: {
      get length() {
        return entries.size;
      },
      key(index: number) {
        return [...entries.keys()][index] ?? null;
      },
      getItem(key: string) {
        return entries.get(key) ?? null;
      },
      removeItem(key: string) {
        entries.delete(key);
      },
    },
  });
  return entries;
}
it("exports guest game data without exposing session tokens or another owner's save", async () => {
  storage();
  expect(await exportLocalData()).toEqual({
    "manager3d.career.v1": { season: 2026 },
    "pfm3d.lang": "pt-BR",
    offlineCareer: {},
    localReplayArchive: {},
  });
});
it("clears guest stores while preserving the signed-in session and another owner's data", async () => {
  const entries = storage();
  await expect(clearLocalData()).resolves.toBe(true);
  expect([...entries]).toEqual([
    ["manager3d.career.v1:user:another-owner", "private-other-player"],
    ["sb-project-auth-token", "private-session"],
  ]);
});
