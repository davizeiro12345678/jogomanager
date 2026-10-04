import { describe, expect, it } from "vitest";

import {
  LIVE_MATCH_WORKER_TELEMETRY_NAME,
  createSnapshotTelemetryTracker,
  estimateSerializedCloneBytes,
  isLiveSnapshotResponse,
  isLiveTelemetryWorker,
  markLiveWorkerSnapshot,
} from "./snapshot-telemetry";

describe("snapshot transport telemetry", () => {
  it("estimates clone payloads without stringifying the snapshot", () => {
    const ascii = estimateSerializedCloneBytes({ label: "gol" });
    const accented = estimateSerializedCloneBytes({ label: "gol ç" });
    const typed = estimateSerializedCloneBytes(new Float32Array([1, 2, 3]));

    expect(ascii).toBeGreaterThan(0);
    expect(accented).toBeGreaterThan(ascii);
    expect(typed).toBeGreaterThanOrEqual(new Float32Array([1, 2, 3]).byteLength);
  });

  it("keeps interval measurements local to a tracker and clamps backwards clocks", () => {
    const tracker = createSnapshotTelemetryTracker();
    const snapshot = { seq: 4, players: [], ball: { x: 0, z: 0 } };

    expect(tracker.sample(snapshot, 120).intervalMs).toBeNull();
    expect(tracker.sample(snapshot, 245).intervalMs).toBe(125);
    expect(tracker.sample(snapshot, 200).intervalMs).toBe(0);
  });

  it("recognizes only live snapshot responses and the explicit telemetry worker", () => {
    const snapshot = { seq: 2, players: [] };

    expect(isLiveSnapshotResponse({ id: 2, ok: true, type: "snapshot", snapshot })).toBe(true);
    expect(isLiveSnapshotResponse({ id: 2, ok: true, type: "finished", result: snapshot })).toBe(
      false,
    );
    expect(isLiveSnapshotResponse({ id: 2, ok: false, error: "erro" })).toBe(false);
    expect(isLiveTelemetryWorker(LIVE_MATCH_WORKER_TELEMETRY_NAME)).toBe(true);
    expect(isLiveTelemetryWorker("stadium-live-match")).toBe(false);
  });

  it("never lets unsupported User Timing interrupt a match bridge", () => {
    const original = performance.mark;
    Object.defineProperty(performance, "mark", {
      configurable: true,
      value: () => {
        throw new Error("user timing unavailable");
      },
    });

    try {
      expect(() =>
        markLiveWorkerSnapshot({ estimatedSerializedBytes: 42, intervalMs: 100 }),
      ).not.toThrow();
    } finally {
      Object.defineProperty(performance, "mark", { configurable: true, value: original });
    }
  });
});
