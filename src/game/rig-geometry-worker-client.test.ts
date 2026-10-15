import { describe, expect, it, vi } from "vitest";
import type { GeometryBatch } from "./rig-geometry.worker";
import { RigGeometryWorkerClient } from "./rig-geometry-worker-client";
import { rigSectionVertexCount } from "./rig-section-kernel";

const batch = {
  identity: "player-1",
  style: "standard",
  lod: 0,
  sections: [
    {
      part: "torso",
      input: {
        rings: new Float64Array([0, 0.2, 0.2, 0, 1, 0.15, 0.14, 0]),
        radial: 16,
        roundness: 1.2,
        caps: 3,
      },
    },
  ],
};

function createWorker(resultFor: (request: GeometryBatch) => unknown) {
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    onmessageerror: null as ((event: MessageEvent) => void) | null,
    postMessage: vi.fn((request: GeometryBatch) => {
      queueMicrotask(() => worker.onmessage?.({ data: resultFor(request) } as MessageEvent));
    }),
    terminate: vi.fn(),
  };
  return worker;
}

describe("RigGeometryWorkerClient", () => {
  it("measures lane wait, worker round trip, response validation, and transfer bytes", async () => {
    const packed = new Float32Array(rigSectionVertexCount(batch.sections[0]!.input) * 5);
    const worker = createWorker((request) => ({
      id: request.id,
      sections: [{ part: "torso", packed: packed.slice().buffer, backend: "rust" }],
      retainedBytes: packed.byteLength,
      degraded: false,
    }));
    const release = vi.fn();
    const client = new RigGeometryWorkerClient(
      () => worker as unknown as Worker,
      async () => release,
    );

    const result = await client.request(batch);

    expect(result?.sections).toHaveLength(1);
    expect(client.stats).toMatchObject({
      requests: 1,
      completed: 1,
      laneWaitMs: expect.any(Number),
      workerRoundTripMs: expect.any(Number),
      responseValidationMs: expect.any(Number),
      inputBytes: batch.sections[0]!.input.rings.byteLength,
      outputBytes: packed.byteLength,
    });
    expect(client.stats.laneWaitMs).toBeGreaterThanOrEqual(0);
    expect(client.stats.workerRoundTripMs).toBeGreaterThanOrEqual(0);
    expect(client.stats.responseValidationMs).toBeGreaterThanOrEqual(0);
    client.dispose();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed returned buffers without reporting completion", async () => {
    const worker = createWorker((request) => ({
      id: request.id,
      sections: [{ part: "torso", packed: new ArrayBuffer(4), backend: "rust" }],
      retainedBytes: 4,
      degraded: false,
    }));
    const client = new RigGeometryWorkerClient(
      () => worker as unknown as Worker,
      async () => () => undefined,
    );

    await expect(client.request(batch)).resolves.toBeNull();
    expect(client.stats.completed).toBe(0);
    client.dispose();
  });

  it("rejects unknown Worker backend metadata", async () => {
    const packed = new Float32Array(rigSectionVertexCount(batch.sections[0]!.input) * 5);
    const worker = createWorker((request) => ({
      id: request.id,
      sections: [{ part: "torso", packed: packed.buffer, backend: "unknown" }],
      retainedBytes: 0,
      degraded: false,
    }));
    const client = new RigGeometryWorkerClient(
      () => worker as unknown as Worker,
      async () => () => undefined,
    );

    await expect(client.request(batch)).resolves.toBeNull();
    expect(client.stats.completed).toBe(0);
    client.dispose();
  });
});
