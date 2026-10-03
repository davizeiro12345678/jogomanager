import { expect, it } from "vitest";
import { expressionFor } from "./animation-extra3";
import { ballGazePitch, emptyFacialPose, facialPoseAt } from "./facial-animation";

it("looks up at an aerial ball and down at a ball near the ground at the same distance", () => {
  expect(ballGazePitch(3, 4, 1.7)).toBeLessThan(0);
  expect(ballGazePitch(3, 0.1, 1.7)).toBeGreaterThan(0);
  const expr = expressionFor("gkDiveHigh", 0.2, 0);
  const high = facialPoseAt(1, 27, expr, 0, ballGazePitch(3, 4, 1.7), 0.2);
  const low = facialPoseAt(1, 27, expr, 0, ballGazePitch(3, 0.1, 1.7), 0.2);
  expect(high.eyeY).toBeGreaterThan(low.eyeY);
});
it("reproduces a frozen close-up and varies identity without consuming simulation randomness", () => {
  const expr = expressionFor("tired", 0.5, 0.8);
  const out = emptyFacialPose();
  expect(facialPoseAt(7.18, 127, expr, 0.3, 0.1, 0.5, out)).toBe(out);
  expect(out).toEqual(facialPoseAt(7.18, 127, expr, 0.3, 0.1, 0.5));
  expect(out).not.toEqual(facialPoseAt(7.18, 129, expr, 0.3, 0.1, 0.5));
});
it("keeps jaw, eyes and eyelids inside their anatomical envelopes with full blink cycles", () => {
  for (const clip of ["idle", "tired", "celebrateArms", "dissent", "gkDiveHigh"]) {
    const expr = expressionFor(clip, 1, 0.9);
    let closed = false,
      reopened = false;
    const out = emptyFacialPose();
    for (let t = 0; t < 24; t += 0.01) {
      facialPoseAt(t, 43, expr, 100, -100, 1, out);
      for (const value of Object.values(out)) expect(Number.isFinite(value)).toBe(true);
      expect(out.jaw).toBeGreaterThanOrEqual(0.008);
      expect(out.jaw).toBeLessThanOrEqual(0.29);
      expect(Math.abs(out.eyeX)).toBeLessThanOrEqual(0.85);
      expect(Math.abs(out.eyeY)).toBeLessThanOrEqual(0.7);
      if (out.lidClosure > 0.9) closed = true;
      if (closed && out.lidClosure < 0.2) reopened = true;
    }
    expect(closed).toBe(true);
    expect(reopened).toBe(true);
  }
});
