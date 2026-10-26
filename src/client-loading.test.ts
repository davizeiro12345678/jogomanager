import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ loaded: 0, hydrate: vi.fn() }));
vi.mock("./hydrate-app", () => {
  state.loaded++;
  return { hydrateApp: state.hydrate };
});
afterEach(() => vi.unstubAllGlobals());
it("discovers the mandatory runtime immediately while retaining the public document's first paint", async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("document", {
    documentElement: { dataset: { publicShell: "true" } },
    hidden: false,
    readyState: "complete",
  });
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
  await import("./client");
  await vi.dynamicImportSettled();
  expect(state.loaded).toBe(1);
  expect(state.hydrate).not.toHaveBeenCalled();
  frames.shift()!(0);
  frames.shift()!(16);
  await vi.dynamicImportSettled();
  expect(state.hydrate).toHaveBeenCalledOnce();
});
