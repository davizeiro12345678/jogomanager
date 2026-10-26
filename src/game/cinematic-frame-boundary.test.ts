import { describe, expect, it } from "vitest";
import { CinematicFrameBoundary } from "./cinematic-frame-boundary";

describe("cinematic measurement boundaries", () => {
  it("excludes the interval spanning an explicit pause and retains the next active frame", () => {
    const boundary = new CinematicFrameBoundary();
    expect(boundary.sample(1 / 60, false)).toBeNull();
    expect(boundary.sample(1 / 60, false)).toBe(1 / 60);
    expect(boundary.sample(10, true)).toBeNull();
    expect(boundary.sample(30, false)).toBeNull();
    expect(boundary.sample(1 / 60, false)).toBe(1 / 60);
  });

  it("keeps a long visible frame in the measured distribution", () => {
    const boundary = new CinematicFrameBoundary();
    boundary.sample(1 / 60, false);
    expect(boundary.sample(3, false)).toBe(3);
    expect(boundary.sample(0.2, false)).toBe(0.2);
  });

  it("rejects invalid intervals without changing the authoritative scene clock", () => {
    const boundary = new CinematicFrameBoundary();
    boundary.sample(0, false);
    for (const value of [NaN, Infinity, -1, 0]) expect(boundary.sample(value, false)).toBeNull();
    expect(boundary.sample(0.05, false)).toBe(0.05);
  });
});
