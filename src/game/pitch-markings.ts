/** Metres and radians, shared by paint generation and geometry checks. */
export const PITCH_PAINT = {
  lineWidth: 0.12,
  centreRadius: 9.15,
  penaltyDepth: 16.5,
  penaltyHalfWidth: 20.16,
  goalAreaDepth: 5.5,
  goalAreaHalfWidth: 9.16,
  penaltySpotDistance: 11,
  cornerRadius: 1,
} as const;

/** The shared goal line is already painted by the field boundary. Draw only
 * the remaining three sides, preventing triple paint along each goal mouth. */
export function pitchBoxPath(side: number, goalLine: number, kind: "penalty" | "goal") {
  const depth = kind === "penalty" ? PITCH_PAINT.penaltyDepth : PITCH_PAINT.goalAreaDepth;
  const halfWidth =
    kind === "penalty" ? PITCH_PAINT.penaltyHalfWidth : PITCH_PAINT.goalAreaHalfWidth;
  return [
    [side * goalLine, -halfWidth],
    [side * (goalLine - depth), -halfWidth],
    [side * (goalLine - depth), halfWidth],
    [side * goalLine, halfWidth],
  ] as const;
}

/** Only the part outside the penalty area is painted. */
export function penaltyArcAngles(side: number): readonly [number, number] {
  const angle = Math.acos(
    (PITCH_PAINT.penaltyDepth - PITCH_PAINT.penaltySpotDistance) / PITCH_PAINT.centreRadius,
  );
  return side > 0 ? [Math.PI - angle, Math.PI + angle] : [-angle, angle];
}

/** A quarter circle faces the interior, never the runoff. */
export function cornerArcAngles(xSide: number, zSide: number): readonly [number, number] {
  const start = xSide > 0 ? (zSide > 0 ? Math.PI : Math.PI / 2) : zSide > 0 ? -Math.PI / 2 : 0;
  return [start, start + Math.PI / 2];
}
