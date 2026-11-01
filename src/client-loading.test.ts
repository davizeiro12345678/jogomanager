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
  vi.stubGlobal("PerformanceObserver", undefined);
});
it("falls back to animation frames when paint observation is unavailable", async () => {
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

it.each(["paint", "hidden"])(
  "waits for real public content paint or visibility change: %s",
  async (event) => {
    const doc = {
      documentElement: { dataset: { publicShell: "true" } },
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    let notify: (entries: { getEntries: () => { name: string }[] }) => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("document", doc);
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        static supportedEntryTypes = ["paint"];
        observe = observe;
        disconnect = disconnect;
        constructor(callback: typeof notify) {
          notify = callback;
        }
      },
    );
    await import("./client");
    await vi.dynamicImportSettled();
    expect(observe).toHaveBeenCalledWith({ type: "paint", buffered: true });
    notify!({ getEntries: () => [{ name: "first-paint" }] });
    await vi.dynamicImportSettled();
    expect(state.loaded).toBe(0);
    if (event === "paint") notify!({ getEntries: () => [{ name: "first-contentful-paint" }] });
    else {
      doc.hidden = true;
      doc.addEventListener.mock.calls[0]![1]();
    }
    await vi.dynamicImportSettled();
    expect(state.hydrate).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(doc.removeEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  },
);

it.each(["missing-entry-types", "unsupported-observation"])(
  "hydrates with a partial PerformanceObserver implementation: %s",
  async (mode) => {
    const frames: FrameRequestCallback[] = [];
    const removeEventListener = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("document", {
      documentElement: { dataset: { publicShell: "true" } },
      hidden: false,
      readyState: "complete",
      addEventListener: vi.fn(),
      removeEventListener,
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal(
      "PerformanceObserver",
      class {
        static supportedEntryTypes = mode === "missing-entry-types" ? undefined : ["paint"];
        disconnect = disconnect;
        observe() {
          throw new Error("Buffered paint observation is unsupported");
        }
      },
    );
    await import("./client");
    await vi.dynamicImportSettled();
    expect(state.loaded).toBe(0);
    frames.shift()!(0);
    frames.shift()!(16);
    await vi.dynamicImportSettled();
    expect(state.hydrate).toHaveBeenCalledOnce();
    if (mode === "unsupported-observation") {
      expect(disconnect).toHaveBeenCalledOnce();
      expect(removeEventListener).toHaveBeenCalledOnce();
    }
  },
);

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
