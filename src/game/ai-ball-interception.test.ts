import { describe, expect, it } from "vitest";

import { predictLooseBallInterception, type InterceptionInput } from "./ai-ball-interception";

const base: InterceptionInput = {
  playerX: 0,
  playerZ: 0,
  playerVx: 0,
  playerVz: 0,
  pace: 70,
  stamina: 100,
  ballX: 6,
  ballZ: 2,
  ballVx: 3,
  ballVz: 0,
};

describe("predictive loose-ball pursuit", () => {
  it("aims ahead of a rolling ball without moving the input state", () => {
    const input = { ...base };
    const target = predictLooseBallInterception(input);
    expect(target.x).toBeGreaterThan(base.ballX);
    expect(target.z).toBe(base.ballZ);
    expect(target.score).toBeGreaterThan(0);
    expect(input).toEqual(base);
  });

  it("gives a moving-away athlete a larger turn-time cost", () => {
    const toward = predictLooseBallInterception({ ...base, playerVx: 4 });
    const away = predictLooseBallInterception({ ...base, playerVx: -4 });
    expect(away.score).toBeGreaterThan(toward.score);
  });

  it("remains deterministic under repeated evaluation", () => {
    const first = predictLooseBallInterception(base);
    for (let index = 0; index < 10; index += 1) {
      expect(predictLooseBallInterception(base)).toEqual(first);
    }
  });

  it("never targets a point outside the playable surface", () => {
    const far = predictLooseBallInterception({
      ...base,
      playerX: 43,
      ballX: 49,
      ballZ: 31,
      ballVx: 60,
      ballVz: 38,
    });
    expect(far.x).toBeLessThanOrEqual(51.5);
    expect(far.z).toBeLessThanOrEqual(33);
    expect(Number.isFinite(far.score)).toBe(true);
  });

  it("refuses non-finite player or ball telemetry before it can poison team AI", () => {
    const invalid = predictLooseBallInterception({ ...base, playerX: Number.NaN });
    expect(invalid).toEqual({ x: 6, z: 2, score: 1_000_000 });
    const corruptedBall = predictLooseBallInterception({ ...base, ballX: Infinity });
    expect(corruptedBall).toEqual({ x: 0, z: 2, score: 1_000_000 });
  });

  it("handles a stationary close ball with finite coordinates", () => {
    const target = predictLooseBallInterception({
      ...base,
      playerX: base.ballX,
      playerZ: base.ballZ,
      ballVx: 0,
      ballVz: 0,
      pace: 0,
      stamina: 0,
    });
    expect(target).toEqual({ x: base.ballX, z: base.ballZ, score: 0 });
  });
});
