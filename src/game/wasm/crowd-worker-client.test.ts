import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishCrowdResult, type CrowdMailbox } from "./crowd-mailbox";
import {
  createCrowdVisibilityLayout,
  selectCrowdFallback,
  type CrowdVisibilityInput,
} from "./crowd-visibility";
import { CrowdWorkerClient, crowdWorkerStats } from "./crowd-worker-client";

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly terminate = vi.fn();
  readonly postMessage = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
  emit(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const clients: CrowdWorkerClient[] = [];
const layout = createCrowdVisibilityLayout(
  Array.from({ length: 4 }, (_, x) => ({ x, y: 0, z: 0 })),
  [{ center: { x: 0, y: 0, z: 0 }, radius: 4, indices: [0, 1, 2, 3] }],
);
const input: CrowdVisibilityInput = {
  layout,
  frustumPlanes: new Float64Array(24),
  camera: { x: 0, y: 2, z: 5 },
  projectedScale: 100,
  perspective: true,
  maxTiles: 2,
  maxInstances: 8,
  detailedPixels: 42,
  meshPixels: 28,
};

function createClient(shared = false) {
  vi.stubGlobal("crossOriginIsolated", shared);
  const release = vi.fn();
  const client = new CrowdWorkerClient(layout, release);
  clients.push(client);
  const worker = TestWorker.instances.at(-1)!;
  worker.emit({ type: "ready", wasm: true });
  return { client, worker, release };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("Worker", TestWorker);
  TestWorker.instances = [];
  Object.assign(crowdWorkerStats, {
    active: 0,
    wasm: false,
    shared: false,
    submitted: 0,
    completed: 0,
    skipped: 0,
    failures: 0,
  });
});

afterEach(() => {
  for (const client of clients.splice(0)) client.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("crowd worker buffers and lifecycle", () => {
  it("ignores stale ordinary results without releasing the active request", () => {
    const { client, worker } = createClient();
    client.select(input);
    const request = worker.postMessage.mock.calls.at(-1)![0];
    worker.emit({ type: "result", requestId: request.requestId - 1, packed: new Uint32Array([2]) });
    expect(crowdWorkerStats.completed).toBe(0);
    worker.emit({ type: "result", requestId: request.requestId, packed: new Uint32Array([2]) });
    expect(crowdWorkerStats.completed).toBe(1);
  });
  it("returns consumed packed storage for transfer without retaining detached views", () => {
    const { client, worker } = createClient();
    client.select(input);
    const requestId = worker.postMessage.mock.calls.at(-1)![0].requestId;
    const packed = new Uint32Array([2, 4]);
    worker.emit({ type: "result", requestId, packed });
    const decoded = client.select(input)!;
    client.select({ ...input, camera: { x: 5, y: 2, z: 5 } });
    const [request, transfers] = worker.postMessage.mock.calls.at(-1)!;
    expect(request.recycled).toBe(packed.buffer);
    expect(transfers).toEqual([packed.buffer]);
    expect([...decoded.indices]).toEqual([0, 1]);
  });
  it("rejects valid tiers referencing seats outside the immutable layout", () => {
    const { client, worker, release } = createClient();
    client.select(input);
    worker.emit({
      type: "result",
      requestId: worker.postMessage.mock.calls.at(-1)![0].requestId,
      packed: new Uint32Array([400]),
    });
    expect(client.select(input)).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("fails closed on a corrupt tier without throwing into the render loop", () => {
    const { client, worker, release } = createClient();
    client.select(input);
    expect(() =>
      worker.emit({
        type: "result",
        requestId: worker.postMessage.mock.calls.at(-1)![0].requestId,
        packed: new Uint32Array([3]),
      }),
    ).not.toThrow();
    expect(client.select(input)).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a corrupt shared result length before decoding", () => {
    const { client, worker, release } = createClient(true);
    const mailbox = worker.postMessage.mock.calls[0]![0].mailbox as CrowdMailbox;
    client.select(input);
    Atomics.store(mailbox.state, 1, -1);
    Atomics.store(mailbox.state, 0, 2);
    expect(client.select(input)).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("terminates a stuck selection even when rendering stops polling", async () => {
    const { client, worker, release } = createClient();
    client.select(input);
    await vi.advanceTimersByTimeAsync(3001);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(client.select(input)).toBeNull();
  });
  it("reuses ordinary message buffers and releases callbacks and its lane only once", () => {
    const { client, worker, release } = createClient();
    client.select(input);
    worker.emit({
      type: "result",
      requestId: worker.postMessage.mock.calls.at(-1)![0].requestId,
      packed: new Uint32Array([2, 4]),
    });
    const first = client.select(input)!;
    const movedInput = { ...input, camera: { ...input.camera, x: 1 } };
    client.select(movedInput);
    worker.emit({
      type: "result",
      requestId: worker.postMessage.mock.calls.at(-1)![0].requestId,
      packed: new Uint32Array([9, 13]),
    });
    const second = client.select(movedInput)!;
    expect(second).toBe(first);
    expect([...second.indices]).toEqual([2, 3]);
    expect([...second.counts]).toEqual([0, 2, 0]);
    client.dispose();
    client.dispose();
    expect(client.select(input)).toBeNull();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(crowdWorkerStats.active).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reuses decoded shared-mailbox buffers without stale counts", () => {
    const { client, worker } = createClient(true);
    const mailbox = worker.postMessage.mock.calls[0]![0].mailbox as CrowdMailbox;
    expect(client.shared).toBe(true);
    client.select(input);
    publishCrowdResult(mailbox, new Uint32Array([2, 4]));
    const first = client.select(input)!;
    client.select({ ...input, camera: { x: 1, y: 2, z: 5 } });
    publishCrowdResult(mailbox, new Uint32Array([9, 13]));
    const second = client.select(input)!;
    expect(second).toBe(first);
    expect([...second.indices]).toEqual([2, 3]);
    expect([...second.counts]).toEqual([0, 2, 0]);
    expect(crowdWorkerStats.completed).toBe(2);
  });

  it("clears a failed worker and does not keep its last response available", () => {
    const { client, worker, release } = createClient();
    client.select(input);
    worker.emit({
      type: "result",
      requestId: worker.postMessage.mock.calls.at(-1)![0].requestId,
      packed: new Uint32Array([2]),
    });
    expect(client.select(input)).not.toBeNull();
    worker.onerror?.();
    client.dispose();
    expect(client.select(input)).toBeNull();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(worker.onmessage).toBeNull();
    expect(crowdWorkerStats.active).toBe(0);
    expect(crowdWorkerStats.failures).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("ignores unsolicited and uncorrelated ordinary replies", () => {
    const { client, worker } = createClient();
    worker.emit({ type: "result", requestId: 1, packed: new Uint32Array([2]) });
    expect(crowdWorkerStats.completed).toBe(0);
    client.select(input);
    worker.emit({ type: "result", packed: new Uint32Array([2]) });
    expect(crowdWorkerStats.completed).toBe(0);
    const requestId = worker.postMessage.mock.calls.at(-1)![0].requestId;
    worker.emit({ type: "result", requestId, packed: new Uint32Array([2]) });
    expect(crowdWorkerStats.completed).toBe(1);
  });
  it("rejects a result exceeding the submitted instance budget", () => {
    const { client, worker, release } = createClient();
    client.select({ ...input, maxInstances: 1 });
    const requestId = worker.postMessage.mock.calls.at(-1)![0].requestId;
    worker.emit({ type: "result", requestId, packed: new Uint32Array([2, 4]) });
    expect(client.failed).toBe(true);
    expect(release).toHaveBeenCalledOnce();
  });
  it("rejects unknown messages including destroy strings and malformed ready flags", () => {
    for (const data of [{ type: "destroy" }, { type: "ready", wasm: "destroy" }, "destroy"]) {
      const { client, worker, release } = createClient();
      worker.emit(data);
      expect(client.failed).toBe(true);
      expect(release).toHaveBeenCalledOnce();
    }
  });
  it("handles malformed camera envelopes without throwing into the render loop", () => {
    for (const malformed of [
      null,
      "destroy",
      { ...input, camera: null },
      { ...input, frustumPlanes: "destroy" },
    ]) {
      const { client, release } = createClient();
      expect(() => client.select(malformed as unknown as CrowdVisibilityInput)).not.toThrow();
      expect(client.failed).toBe(true);
      expect(release).toHaveBeenCalledOnce();
    }
  });

  it.each([
    ["camera", { camera: { x: Number.NaN, y: 2, z: 5 } }],
    [
      "frustum",
      { frustumPlanes: new Float64Array([Number.POSITIVE_INFINITY, ...Array(23).fill(0)]) },
    ],
    ["projected scale", { projectedScale: Number.NaN }],
    ["tile budget", { maxTiles: Number.POSITIVE_INFINITY }],
    ["instance budget", { maxInstances: Number.NaN }],
    ["detail threshold", { detailedPixels: Number.NEGATIVE_INFINITY }],
    ["mesh threshold", { meshPixels: Number.NaN }],
    ["projection mode", { perspective: "destroy" }],
  ])(
    "fails closed before posting non-finite %s values while keeping the TS fallback safe",
    (_name, patch) => {
      const { client, worker, release } = createClient();
      const malformed = { ...input, ...patch } as CrowdVisibilityInput;

      expect(client.select(malformed)).toBeNull();
      expect(worker.postMessage).toHaveBeenCalledOnce(); // static init only; no camera crosses the boundary
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      expect(crowdWorkerStats.active).toBe(0);
      expect(vi.getTimerCount()).toBe(0);

      // CrowdLod switches to this canonical path when the optional lane fails.
      expect(() => selectCrowdFallback(malformed)).not.toThrow();
      expect(selectCrowdFallback(input).indices).toHaveLength(4);
    },
  );
});
