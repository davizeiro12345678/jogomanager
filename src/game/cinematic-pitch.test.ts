import { expect, it } from "vitest";
import { FIELD_X, FIELD_Z } from "./sim-rules";
import { PITCH_PAINT } from "./pitch-markings";
import { cinematicPitchToWorld, CINEMATIC_GOAL_Z } from "./cinematic-pitch";

it("aligns regulation paint with the cinematic goal without moving training contacts", () => {
  expect(cinematicPitchToWorld(FIELD_X, 0)).toEqual({ x: -0, z: CINEMATIC_GOAL_Z });
  expect(cinematicPitchToWorld(FIELD_X - PITCH_PAINT.goalAreaDepth, 0).z).toBe(-10.5);
  expect(cinematicPitchToWorld(FIELD_X - PITCH_PAINT.penaltyDepth, 0).z).toBe(0.5);
  expect(cinematicPitchToWorld(FIELD_X - PITCH_PAINT.penaltySpotDistance, 0).z).toBe(-5);
  expect(cinematicPitchToWorld(FIELD_X, FIELD_Z).x).toBe(-34);
  expect(cinematicPitchToWorld(-FIELD_X, 0).z - CINEMATIC_GOAL_Z).toBe(105);
});
