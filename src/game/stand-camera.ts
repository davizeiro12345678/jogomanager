/** A front-row eye position that stays above the stepped concrete and below
 * the roof, including the minimum three-row adaptive stadium. */
export function standCameraPosition(fieldEdge: number, side: number) {
  const row = 2;
  return {
    y: 2 + row * 1.45 + 2.8,
    z: (side >= 0 ? 1 : -1) * (fieldEdge + 7 + row * 1.5),
  };
}

export function keepPitchCameraInRunoff(
  position: { x: number; y: number; z: number },
  fieldHalfLength: number,
  fieldHalfWidth: number,
) {
  const raisedClearance = Math.max(0, position.y - 1.9) * (1.5 / 1.45);
  const endLimit = fieldHalfLength + 7 + raisedClearance;
  const sideLimit = fieldHalfWidth + 4 + raisedClearance;
  position.x = Math.max(-endLimit, Math.min(endLimit, position.x));
  position.z = Math.max(-sideLimit, Math.min(sideLimit, position.z));
}
