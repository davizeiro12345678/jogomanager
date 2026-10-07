import { describe, expect, it } from "vitest";

import { snapshotMatch, WorkerMatchView } from "./live-match";
import { MatchSim } from "./sim";
import { buildTeamSetup } from "./quickMatch";

function percentile(values: number[], p: number) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)] ?? 0;
}

describe("baseline snapshot telemetry", () => {
  it("records the current object-snapshot payload and apply cost", () => {
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    const sim = new MatchSim(home, away, "baseline-2026-10-06");
    const view = new WorkerMatchView(home, away);
    const payloadBytes: number[] = [];
    const applyMs: number[] = [];

    for (let index = 0; index < 120; index += 1) {
      sim.step(1 / 30, 6);
      const snapshot = snapshotMatch(sim, index + 1);
      payloadBytes.push(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength);
      const started = performance.now();
      view.apply(snapshot);
      applyMs.push(performance.now() - started);
    }

    const report = {
      samples: payloadBytes.length,
      snapshotBytes: {
        mean: payloadBytes.reduce((sum, value) => sum + value, 0) / payloadBytes.length,
        p95: percentile(payloadBytes, 0.95),
        max: Math.max(...payloadBytes),
      },
      applyMs: {
        mean: applyMs.reduce((sum, value) => sum + value, 0) / applyMs.length,
        p95: percentile(applyMs, 0.95),
        max: Math.max(...applyMs),
      },
      heapBytes: null,
      note: "Vitest Node process does not expose browser performance.memory; graphics heap must be captured in a Chromium profile.",
    };
    console.log(`BASELINE_SNAPSHOT ${JSON.stringify(report)}`);
    expect(payloadBytes.every((value) => value > 0)).toBe(true);
    expect(applyMs.every((value) => Number.isFinite(value))).toBe(true);
  });
});
