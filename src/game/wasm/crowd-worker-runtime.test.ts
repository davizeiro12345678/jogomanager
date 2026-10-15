import { describe, expect, it, vi } from "vitest";
import { CrowdWorkerRuntime, type PersistentCrowdSelector } from "./crowd-worker-runtime";
import { createCrowdVisibilityLayout } from "./crowd-visibility";
import { createCrowdMailbox, writeCrowdCamera } from "./crowd-mailbox";

const layout = createCrowdVisibilityLayout(
  [{ x: 0, y: 0, z: 0 }],
  [{ center: { x: 0, y: 0, z: 0 }, radius: 1, indices: [0] }],
);
function camera() {
  const values = new Float64Array(33);
  writeCrowdCamera(values, {
    layout,
    camera: { x: 0, y: 0, z: 0 },
    frustumPlanes: new Float64Array(),
    projectedScale: 1,
    perspective: false,
    maxTiles: 1,
    maxInstances: 1,
    detailedPixels: 2,
    meshPixels: 1,
  });
  return values;
}
describe("crowd runtime initialization and ownership", () => {
  it("preserves the initialized layout and Rust owner when a replacement request is invalid", async () => {
    const selector = { select: vi.fn(() => new Uint32Array([1])), free: vi.fn() };
    const load = vi.fn(async () => selector),
      post = vi.fn();
    const runtime = new CrowdWorkerRuntime(load, post);
    runtime.handle({ type: "init", layout });
    await Promise.resolve();
    for (const request of [
      { type: "init" as const, layout: { ...layout, tileCount: 2 ** 31 } },
      {
        type: "init" as const,
        layout,
        mailbox: { ...createCrowdMailbox(), state: new Int32Array(2) },
      },
    ]) {
      runtime.handle(request);
      expect(post.mock.calls.at(-1)![0]).toEqual({ type: "failed" });
      expect(selector.free).not.toHaveBeenCalled();
      runtime.handle({ type: "select", camera: camera() });
      expect(post.mock.calls.at(-1)![0]).toMatchObject({
        type: "result",
        packed: new Uint32Array([1]),
      });
    }
    expect(load).toHaveBeenCalledOnce();
    expect(selector.select).toHaveBeenCalledTimes(2);
    runtime.dispose();
    runtime.dispose();
    expect(selector.free).toHaveBeenCalledOnce();
  });

  it("replaces a valid owner once and frees a pending late owner after disposal", async () => {
    const owners: Array<(owner: PersistentCrowdSelector) => void> = [];
    const runtime = new CrowdWorkerRuntime(
      () => new Promise((resolve) => owners.push(resolve)),
      vi.fn(),
    );
    const first = { select: vi.fn(), free: vi.fn() },
      late = { select: vi.fn(), free: vi.fn() };
    runtime.handle({ type: "init", layout });
    owners[0]!(first);
    await Promise.resolve();
    runtime.handle({ type: "init", layout });
    expect(first.free).toHaveBeenCalledOnce();
    runtime.dispose();
    owners[1]!(late);
    await Promise.resolve();
    expect(late.free).toHaveBeenCalledOnce();
    runtime.dispose();
    expect(first.free).toHaveBeenCalledOnce();
    expect(late.free).toHaveBeenCalledOnce();
  });
  it("rejects truncated or ordinary mailbox views before loading", () => {
    for (const state of [new Int32Array(new SharedArrayBuffer(4)), new Int32Array(2)]) {
      const post = vi.fn(),
        load = vi.fn(async () => null);
      new CrowdWorkerRuntime(load, post).handle({
        type: "init",
        layout,
        mailbox: { ...createCrowdMailbox(), state },
      });
      expect(load).not.toHaveBeenCalled();
      expect(post).toHaveBeenCalledWith({ type: "failed" });
    }
  });
  it("rejects forged layout counts before loading or allocating its scratch", () => {
    const post = vi.fn(),
      load = vi.fn(async () => null);
    const runtime = new CrowdWorkerRuntime(load, post);
    runtime.handle({ type: "init", layout: { ...layout, tileCount: 2 ** 31 } });
    expect(load).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({ type: "failed" });
  });
  it("recycles fallback storage and correlates ordinary replies", () => {
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(() => new Promise(() => {}), post);
    runtime.handle({ type: "init", layout });
    const recycled = new ArrayBuffer(8);
    runtime.handle({ type: "select", camera: camera(), recycled, requestId: 7 });
    const [result, transfers] = post.mock.calls.at(-1)!;
    expect(result.requestId).toBe(7);
    expect(result.packed.buffer).toBe(recycled);
    expect([...result.packed]).toEqual([1]);
    expect(transfers).toEqual([recycled]);
  });
  it("uses reusable WASM output instead of the allocating legacy method", async () => {
    const select = vi.fn();
    const select_into = vi.fn((...args: unknown[]) => {
      const output = args[8] as Uint32Array;
      output[0] = 1;
      return 1;
    });
    const selector = { select, select_into, free: vi.fn() };
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(async () => selector, post);
    runtime.handle({ type: "init", layout });
    await Promise.resolve();
    runtime.handle({ type: "select", camera: camera() });
    runtime.handle({ type: "select", camera: camera() });
    expect(select).not.toHaveBeenCalled();
    expect(select_into.mock.calls[0]![8]).toBe(select_into.mock.calls[1]![8]);
    expect(post.mock.calls.at(-1)![0]).toMatchObject({
      type: "result",
      packed: new Uint32Array([1]),
    });
    runtime.dispose();
    expect(selector.free).toHaveBeenCalledOnce();
  });
  it("falls back and frees Rust once when reusable output length is invalid", async () => {
    const selector = { select: vi.fn(), select_into: vi.fn(() => -1), free: vi.fn() };
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(async () => selector, post);
    runtime.handle({ type: "init", layout });
    await Promise.resolve();
    runtime.handle({ type: "select", camera: camera() });
    expect(post.mock.calls.at(-1)![0]).toMatchObject({
      type: "result",
      packed: new Uint32Array([1]),
    });
    runtime.dispose();
    expect(selector.free).toHaveBeenCalledOnce();
  });
  it("serves fallback before optional compilation completes", () => {
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(() => new Promise(() => {}), post);
    runtime.handle({ type: "init", layout });
    runtime.handle({ type: "select", camera: camera() });
    expect(post.mock.calls[0]![0]).toEqual({ type: "ready", wasm: false });
    expect(post.mock.calls[1]![0]).toEqual({ type: "result", packed: new Uint32Array([1]) });
  });
  it("frees a late Rust owner after reinitialization", async () => {
    const resolvers: Array<(selector: PersistentCrowdSelector) => void> = [];
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(
      () => new Promise((resolve) => resolvers.push(resolve)),
      post,
    );
    runtime.handle({ type: "init", layout });
    runtime.handle({ type: "init", layout });
    const stale = { select: vi.fn(), free: vi.fn() };
    resolvers[0]!(stale);
    await Promise.resolve();
    expect(stale.free).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(2);
  });
  it("falls back on a Rust trap and frees its selector once", async () => {
    const selector = {
      select: vi.fn(() => {
        throw new Error("WASM trap");
      }),
      free: vi.fn(),
    };
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(async () => selector, post);
    runtime.handle({ type: "init", layout });
    await Promise.resolve();
    runtime.handle({ type: "select", camera: camera() });
    runtime.handle({ type: "select", camera: camera() });
    runtime.dispose();
    expect(selector.select).toHaveBeenCalledTimes(1);
    expect(selector.free).toHaveBeenCalledTimes(1);
    expect(post.mock.calls.at(-1)![0]).toEqual({ type: "result", packed: new Uint32Array([1]) });
  });
  it("rejects truncated camera frames", () => {
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(async () => null, post);
    runtime.handle({ type: "init", layout });
    runtime.handle({ type: "select", camera: new Float64Array(2) });
    expect(post.mock.calls.at(-1)![0]).toEqual({ type: "failed" });
  });
  it("keeps fallback usable even if the trapped WASM owner's free also traps", async () => {
    const selector = {
      select: vi.fn(() => {
        throw new Error("WASM trap");
      }),
      free: vi.fn(() => {
        throw new Error("WASM free trap");
      }),
    };
    const post = vi.fn();
    const runtime = new CrowdWorkerRuntime(async () => selector, post);
    runtime.handle({ type: "init", layout });
    await Promise.resolve();
    runtime.handle({ type: "select", camera: camera() });
    runtime.handle({ type: "select", camera: camera() });
    expect(post.mock.calls.at(-1)![0]).toEqual({ type: "result", packed: new Uint32Array([1]) });
    expect(selector.select).toHaveBeenCalledOnce();
    expect(selector.free).toHaveBeenCalledOnce();
    expect(() => runtime.dispose()).not.toThrow();
  });
  it("rejects corrupt WASM seats and tiers before publishing, then uses fallback", async () => {
    for (const packed of [new Uint32Array([3]), new Uint32Array([4]), new Uint32Array([1, 1])]) {
      const selector = { select: vi.fn(() => packed), free: vi.fn() };
      const post = vi.fn();
      const runtime = new CrowdWorkerRuntime(async () => selector, post);
      runtime.handle({ type: "init", layout });
      await Promise.resolve();
      runtime.handle({ type: "select", camera: camera() });
      expect(post.mock.calls.at(-1)![0]).toEqual({ type: "result", packed: new Uint32Array([1]) });
      expect(selector.free).toHaveBeenCalledOnce();
      runtime.dispose();
      expect(selector.free).toHaveBeenCalledOnce();
    }
  });
  it("rejects overlapping shared views before atomics or WASM loading", () => {
    const arena = new SharedArrayBuffer(5120 * 4);
    const load = vi.fn(async () => null),
      post = vi.fn();
    const runtime = new CrowdWorkerRuntime(load, post);
    runtime.handle({
      type: "init",
      layout,
      mailbox: {
        state: new Int32Array(arena, 0, 2),
        camera: new Float64Array(arena, 0, 33),
        packed: new Uint32Array(arena, 0, 5120),
      },
    });
    expect(load).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({ type: "failed" });
  });
  it("does not select a shared camera that has not been published", () => {
    const post = vi.fn(),
      runtime = new CrowdWorkerRuntime(async () => null, post);
    runtime.handle({ type: "init", layout, mailbox: createCrowdMailbox() });
    runtime.handle({ type: "select", requestId: 1 });
    expect(post.mock.calls.at(-1)![0]).toEqual({ type: "failed" });
  });
});
