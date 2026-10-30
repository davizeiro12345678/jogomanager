import { afterEach, expect, it, vi } from "vitest";
import { clearLocalData, exportLocalData } from "./local-data-controls";
afterEach(() => vi.unstubAllGlobals());
function storage() {
  const entries = new Map([
    ["pfm-save", '{"season":2026}'],
    ["pfm-theme", "dark"],
    ["sb-project-auth-token", "private-session"],
  ]);
  vi.stubGlobal("window", {
    dispatchEvent: vi.fn(),
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
it("exports game data without exposing Supabase session tokens", () => {
  storage();
  expect(exportLocalData()).toEqual({ "pfm-save": { season: 2026 }, "pfm-theme": "dark" });
});
it("clears a stable snapshot of game keys while preserving the signed-in session", () => {
  const entries = storage();
  clearLocalData();
  expect([...entries]).toEqual([["sb-project-auth-token", "private-session"]]);
  expect(window.dispatchEvent).toHaveBeenCalledWith(
    expect.objectContaining({ type: "consent-changed" }),
  );
});
