import { afterEach, describe, expect, it, vi } from "vitest";
const acquire = vi.hoisted(() => vi.fn());
vi.mock("../presentation-lanes", () => ({ acquirePresentationLanes: acquire }));
const source = {
  positions: Array.from({ length: 512 }, () => ({ x: 0, y: 0, z: 0 })),
  colors: Array.from({ length: 512 }, () => ({ r: 1, g: 1, b: 1 })),
  skins: Array.from({ length: 512 }, () => ({ r: 1, g: 1, b: 1 })),
};
async function setup() {
  vi.resetModules();
  vi.stubGlobal("crossOriginIsolated", true);
  vi.stubGlobal("navigator", { hardwareConcurrency: 8 });
  vi.stubGlobal("Worker", vi.fn());
  acquire.mockReset();
  return import("./shared-seat-transforms");
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("shared seat preparation lifecycle", () => {
  it("cancels stalled compilation without reserving CPU lanes", async () => {
    const { prepareSharedSeatBuffers } = await setup();
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    const controller = new AbortController();
    const result = prepareSharedSeatBuffers(source, controller.signal);
    controller.abort();
    expect(await result).toBeNull();
    expect(acquire).not.toHaveBeenCalled();
  });
  it("bounds stalled compilation and aborts the request", async () => {
    vi.useFakeTimers();
    const { prepareSharedSeatBuffers } = await setup();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", (_url: string, options: RequestInit) => {
      requestSignal = options.signal as AbortSignal;
      return new Promise(() => {});
    });
    const result = prepareSharedSeatBuffers(source, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await result).toBeNull();
    expect(requestSignal?.aborted).toBe(true);
    expect(acquire).not.toHaveBeenCalled();
  });
  it("rejects mismatched attributes before fetching or allocating", async () => {
    const { prepareSharedSeatBuffers } = await setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      await prepareSharedSeatBuffers({ ...source, colors: [] }, new AbortController().signal),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects non-finite or overflowing source attributes before GPU buffer generation", async () => {
    const { prepareSharedSeatBuffers } = await setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const x of [NaN, Infinity, Number.MAX_VALUE]) {
      const positions = [...source.positions];
      positions[0] = { x, y: 0, z: 0 };
      expect(
        await prepareSharedSeatBuffers({ ...source, positions }, new AbortController().signal),
      ).toBeNull();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(acquire).not.toHaveBeenCalled();
  });
  it("releases all lanes and arenas after a message cloning failure", async () => {
    const { prepareSharedSeatBuffers, sharedSeatStats } = await setup();
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]).buffer,
    }));
    const release = vi.fn();
    acquire.mockResolvedValue(release);
    const terminate = vi.fn();
    vi.stubGlobal(
      "Worker",
      class {
        terminate = terminate;
        postMessage() {
          throw new Error("DataCloneError");
        }
      },
    );
    expect(await prepareSharedSeatBuffers(source, new AbortController().signal)).toBeNull();
    expect(release).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledTimes(2);
    expect(sharedSeatStats.workers).toBe(0);
    expect(sharedSeatStats.arenaBytes).toBe(0);
    expect(sharedSeatStats.failures).toBe(1);
  });
});
