import { afterEach, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ loaded: 0, hydrate: vi.fn() }));
vi.mock("./hydrate-app", () => {
  state.loaded++;
  return { hydrateApp: state.hydrate };
});
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetModules();
  state.loaded = 0;
  state.hydrate.mockClear();
});
it("leaves the public document's first paint free of application evaluation", async () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("document", {
    documentElement: { dataset: { publicShell: "true" } },
    hidden: false,
    readyState: "complete",
  });
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
  await import("./client");
  await vi.dynamicImportSettled();
  expect(state.loaded).toBe(0);
  expect(state.hydrate).not.toHaveBeenCalled();
  frames.shift()!(0);
  frames.shift()!(16);
  await vi.dynamicImportSettled();
  expect(state.hydrate).toHaveBeenCalledOnce();
});

it.each([
  { publicShell: "false", hidden: false },
  { publicShell: "true", hidden: true },
])(
  "initializes gameplay and hidden documents without waiting for animation frames: %j",
  async (mode) => {
    const frame = vi.fn();
    vi.stubGlobal("document", {
      documentElement: { dataset: { publicShell: mode.publicShell } },
      hidden: mode.hidden,
      readyState: "complete",
    });
    vi.stubGlobal("requestAnimationFrame", frame);
    await import("./client");
    await vi.dynamicImportSettled();
    expect(frame).not.toHaveBeenCalled();
    expect(state.hydrate).toHaveBeenCalledOnce();
  },
);
