import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./hydrate-app");
  vi.resetModules();
  vi.unstubAllGlobals();
});

async function loadClient({ editorial = false, hidden = false, publicShell = true } = {}) {
  const hydrate = vi.fn();
  const load = vi.fn(() => ({ hydrateApp: hydrate }));
  vi.doMock("./hydrate-app", load);
  const frames: FrameRequestCallback[] = [];
  const events = new EventTarget();
  const document = {
    documentElement: {
      dataset: { publicShell: String(publicShell), editorialShell: String(editorial) },
    },
    hidden,
    readyState: "complete",
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  };
  vi.stubGlobal("document", document);
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => frames.push(frame));
  await import("./client");
  await vi.dynamicImportSettled();
  return { document, events, frames, hydrate, load };
}

it("discovers the runtime immediately while retaining first paint on other public pages", async () => {
  const { frames, hydrate, load } = await loadClient();
  expect(load).toHaveBeenCalledOnce();
  expect(hydrate).not.toHaveBeenCalled();
  frames.shift()!(0);
  frames.shift()!(16);
  await vi.dynamicImportSettled();
  expect(hydrate).toHaveBeenCalledOnce();
});

it("gives a visible editorial document two animation frames before loading the runtime", async () => {
  const { document, frames, hydrate, load } = await loadClient({ editorial: true });
  expect(load).not.toHaveBeenCalled();
  frames.shift()!(0);
  expect(load).not.toHaveBeenCalled();
  frames.shift()!(16);
  await Promise.resolve();
  await vi.dynamicImportSettled();
  expect(load).toHaveBeenCalledOnce();
  expect(hydrate).toHaveBeenCalledOnce();
  expect(document.removeEventListener).toHaveBeenCalledWith(
    "visibilitychange",
    expect.any(Function),
  );
});

it("resumes an editorial runtime immediately when the tab becomes hidden before paint", async () => {
  const { document, events, hydrate, load } = await loadClient({ editorial: true });
  expect(load).not.toHaveBeenCalled();
  document.hidden = true;
  events.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  await vi.dynamicImportSettled();
  expect(load).toHaveBeenCalledOnce();
  expect(hydrate).toHaveBeenCalledOnce();
  expect(document.removeEventListener).toHaveBeenCalledWith(
    "visibilitychange",
    expect.any(Function),
  );
});

it.each([{ editorial: true, hidden: true }, { publicShell: false }])(
  "loads and hydrates immediately without waiting for paint when %j",
  async (options) => {
    const { frames, hydrate, load } = await loadClient(options);
    expect(frames).toHaveLength(0);
    expect(load).toHaveBeenCalledOnce();
    expect(hydrate).toHaveBeenCalledOnce();
  },
);
