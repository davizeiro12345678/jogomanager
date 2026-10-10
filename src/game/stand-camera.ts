/** A front-row eye position that stays above the stepped concrete and below
 * the roof, including the minimum three-row adaptive stadium. */
export function standCameraPosition(fieldEdge: number, side: number) {
  const row = 2;
  return {
    y: 2 + row * 1.45 + 2.8,
    z: (side >= 0 ? 1 : -1) * (fieldEdge + 7 + row * 1.5),
  };
}
