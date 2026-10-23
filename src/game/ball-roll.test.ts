import { expect, it } from "vitest";
import { BallRoll } from "./ball-roll";
it("does not consume travel or flight momentum on invalid display intervals", () => {
  for (const invalid of [0, -0.1, NaN, Infinity, -Infinity]) {
    const control = new BallRoll(),
      interrupted = new BallRoll();
    control.step(0, 0, 0.12, 0);
    interrupted.step(0, 0, 0.12, 0);
    const expected = { ...control.step(1, 0, 0.12, 0.02) };
    expect(interrupted.step(1, 0, 0.12, invalid).angle).toBe(0);
    expect({ ...interrupted.step(1, 0, 0.12, 0.02) }).toEqual(expected);
    const beforeFlight = { ...control.step(1, 0, 2, 0.02) };
    interrupted.step(2, 0, 2, invalid);
    expect({ ...interrupted.step(1, 0, 2, 0.02) }).toEqual(beforeFlight);
    expect(interrupted.step(20, 0, 0.12, invalid, true).angle).toBe(0);
    expect(interrupted.step(20.1, 0, 0.12, 0.02).angle).toBeCloseTo(0.1 / 0.12, 10);
  }
});
it("rolls one circumference per revolution at different display rates", () => {
  for (const fps of [20, 30, 60, 120]) {
    const roll = new BallRoll();
    roll.step(0, 0, 0.12, 0);
    let angle = 0;
    for (let i = 1; i <= fps; i++)
      angle += roll.step((i / fps) * 2 * Math.PI * 0.12, 0, 0.12, 1 / fps).angle;
    expect(angle).toBeCloseTo(2 * Math.PI, 10);
  }
});
it("retains flight spin through changing travel direction and resets on a replay seek", () => {
  const roll = new BallRoll();
  roll.step(0, 0, 0.12, 0);
  const initial = { ...roll.step(0.1, 0, 0.12, 0.02) };
  const flight = { ...roll.step(0.1, 0.1, 2, 0.02) };
  expect(flight.axisZ).toBe(initial.axisZ);
  expect(flight.axisX).toBe(initial.axisX);
  expect(flight.angle).toBeGreaterThan(0);
  expect(roll.step(40, 0, 0.12, 0.02).angle).toBe(0);
  expect(roll.step(40, 0, 0.12, NaN).angle).toBe(0);
});
