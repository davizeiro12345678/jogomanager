import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ loaded: 0, hydrate: vi.fn() }));
beforeEach(() => {
  vi.resetModules();
  state.loaded = 0;
  state.hydrate.mockClear();
  vi.doMock("./hydrate-app", () => {
    state.loaded++;
    return { hydrateApp: state.hydrate };
  });
});
afterEach(() => {
  vi.doUnmock("./hydrate-app");
  vi.unstubAllGlobals();
});

function browser(publicShell = true, hidden = false, readyState = "complete") {
  const doc = Object.assign(new EventTarget(), {
    documentElement: { dataset: { publicShell: String(publicShell) } },
    hidden,
    readyState,
  });
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
  return { doc, frames };
}

it("paints public content before importing and evaluating the mandatory runtime", async () => {
  const { frames } = browser();
  await import("./client");
  await vi.dynamicImportSettled();
  expect(state.loaded).toBe(0);
  expect(state.hydrate).not.toHaveBeenCalled();
  frames.shift()!(0);
  await vi.dynamicImportSettled();
  expect(state.loaded).toBe(0);
  frames.shift()!(16);
  await vi.dynamicImportSettled();
  expect(state.loaded).toBe(1);
  expect(state.hydrate).toHaveBeenCalledOnce();
});

it.each([
  [false, false],
  [true, true],
])("starts immediately for public=%s, hidden=%s", async (publicShell, hidden) => {
  const { frames } = browser(publicShell, hidden);
  await import("./client");
  await vi.dynamicImportSettled();
  expect(frames).toHaveLength(0);
  expect(state.loaded).toBe(1);
  expect(state.hydrate).toHaveBeenCalledOnce();
});

it("does not stall or hydrate twice when the document hides before first paint", async () => {
  const { doc, frames } = browser();
  await import("./client");
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  await vi.dynamicImportSettled();
  expect(state.loaded).toBe(1);
  expect(state.hydrate).toHaveBeenCalledOnce();
  frames.shift()!(0);
  frames.shift()!(16);
  await vi.dynamicImportSettled();
  expect(state.hydrate).toHaveBeenCalledOnce();
});

it("waits for parsed public markup before scheduling the paint barrier", async () => {
  const { doc, frames } = browser(true, false, "loading");
  await import("./client");
  await vi.dynamicImportSettled();
  expect(frames).toHaveLength(0);
  expect(state.loaded).toBe(0);
  doc.readyState = "interactive";
  doc.dispatchEvent(new Event("DOMContentLoaded"));
  frames.shift()!(0);
  frames.shift()!(16);
  await vi.dynamicImportSettled();
  expect(state.hydrate).toHaveBeenCalledOnce();
});
