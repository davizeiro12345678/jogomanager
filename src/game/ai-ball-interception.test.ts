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
