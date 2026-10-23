import { FIELD_X } from "./sim-rules";

/** The existing cinematic goal, actors and training contacts keep their world
 * coordinates. Rotate the regulation pitch around that goal, not the actors. */
export const CINEMATIC_GOAL_Z = -16;
export const CINEMATIC_PITCH_CENTRE_Z = CINEMATIC_GOAL_Z + FIELD_X;
export function cinematicPitchToWorld(longitudinal: number, lateral: number) {
  return { x: -lateral, z: CINEMATIC_PITCH_CENTRE_Z - longitudinal };
}
