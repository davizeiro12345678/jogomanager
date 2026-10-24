import { describe, expect, it } from "vitest";
import {
  createMatchAnalytics,
  recordPass,
  recordPassReception,
  type MatchAnalyticsV1,
} from "./match-analytics";
import type { Side, SimPlayer } from "./sim-types";

// Analytics reads only identity, side and measured position from a player.
const player = (pid: string, side: Side = "home") =>
  ({ id: pid, pid, side, name: pid, x: 10, z: 2 }) as SimPlayer;
const from = player("sender"),
  intended = player("intended"),
  actual = player("actual");
function totals(a: MatchAnalyticsV1) {
  return a.connections.reduce(
    (sum, edge) => [sum[0]! + edge.attempts, sum[1]! + edge.completed],
    [0, 0],
  );
}
function coherent(a: MatchAnalyticsV1) {
  for (const edge of a.connections) {
    expect(edge.attempts).toBeGreaterThanOrEqual(edge.completed);
    expect(edge.completed).toBeGreaterThanOrEqual(0);
  }
  for (const period of a.periods ?? [])
    for (const [, attempts, completed] of period.passes) {
      expect(attempts).toBeGreaterThanOrEqual(completed);
      expect(completed).toBeGreaterThanOrEqual(0);
    }
}

describe("actual pass recipient attribution", () => {
  it("moves one attempted connection to the actual teammate and completes it once", () => {
    const a = createMatchAnalytics();
    recordPass(a, from, intended);
    expect(recordPassReception(a, from, intended, actual)).toBe(true);
    expect(totals(a)).toEqual([1, 1]);
    expect(a.connections.find((e) => e.to === intended.pid)).toMatchObject({
      attempts: 0,
      completed: 0,
    });
    expect(a.connections.find((e) => e.to === actual.pid)).toMatchObject({
      attempts: 1,
      completed: 1,
    });
    coherent(a);
  });

  it("retains the original attempt period when reception crosses the fifteen-minute boundary", () => {
    const a = createMatchAnalytics();
    a.lastSample = 899;
    recordPass(a, from, actual);
    recordPassReception(a, from, actual, actual);
    recordPass(a, from, intended);
    a.lastSample = 901;
    recordPassReception(a, from, intended, actual);
    expect(totals(a)).toEqual([2, 2]);
    const index = a.connections.findIndex((e) => e.to === actual.pid);
    expect(a.periods?.find((p) => p.from === 0)?.passes.find((p) => p[0] === index)).toEqual([
      index,
      2,
      2,
    ]);
    expect(a.periods?.find((p) => p.from === 15)?.passes.every((p) => p[2] === 0) ?? true).toBe(
      true,
    );
    coherent(a);
  });

  it("completes the intended pass without creating another attempt", () => {
    const a = createMatchAnalytics();
    recordPass(a, from, intended);
    expect(recordPassReception(a, from, intended, intended)).toBe(true);
    expect(totals(a)).toEqual([1, 1]);
    expect(recordPassReception(a, from, intended, intended)).toBe(false);
    expect(totals(a)).toEqual([1, 1]);
    coherent(a);
  });

  it("does not invent an attempt or completion without pending recorded data", () => {
    const a = createMatchAnalytics();
    const before = structuredClone(a);
    expect(recordPassReception(a, from, intended, actual)).toBe(false);
    expect(a).toEqual(before);
  });

  it("does not treat an opponent interception or the passer's own recovery as a completion", () => {
    const a = createMatchAnalytics();
    recordPass(a, from, intended);
    const before = structuredClone(a);
    expect(recordPassReception(a, from, intended, player("opponent", "away"))).toBe(false);
    expect(recordPassReception(a, from, intended, from)).toBe(false);
    expect(a).toEqual(before);
  });

  it("keeps a full bounded graph unchanged when the actual connection cannot be represented", () => {
    const a = createMatchAnalytics();
    recordPass(a, from, intended);
    while (a.connections.length < 484) {
      a.connections.push({
        ...a.connections[0]!,
        to: `other-${a.connections.length}`,
        attempts: 0,
      });
    }
    const before = structuredClone(a);
    expect(recordPassReception(a, from, intended, actual)).toBe(false);
    expect(a).toEqual(before);
  });

  it("recovers a known pending legacy connection without period data", () => {
    const a = createMatchAnalytics();
    recordPass(a, from, intended);
    delete a.periods;
    recordPassReception(a, from, intended, actual);
    expect(totals(a)).toEqual([1, 1]);
    coherent(a);
  });

  it("preserves historical completions and produces the same result after JSON recovery", () => {
    const a = createMatchAnalytics();
    for (let i = 0; i < 2; i++) {
      recordPass(a, from, intended);
      recordPassReception(a, from, intended, intended);
    }
    recordPass(a, from, intended);
    const restored = JSON.parse(JSON.stringify(a)) as MatchAnalyticsV1;
    recordPassReception(a, from, intended, actual);
    recordPassReception(restored, from, intended, actual);
    expect(a).toEqual(restored);
    expect(totals(a)).toEqual([3, 3]);
    expect(a.connections.find((e) => e.to === intended.pid)).toMatchObject({
      attempts: 2,
      completed: 2,
    });
    coherent(a);
  });
});
