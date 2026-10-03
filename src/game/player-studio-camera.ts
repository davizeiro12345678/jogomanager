/** Inspection cameras use metres, just like the rig. The fit and orbit limits
 * must share the same scale, otherwise OrbitControls clips portrait previews. */
export function studioCameraFit(
  height: number,
  aspect: number,
  fov: number,
  framing: string,
  overhead = false,
  groundAction = false,
) {
  const h = Number.isFinite(height) ? Math.max(1.4, Math.min(2.3, height)) : 1.8;
  const ratio = Number.isFinite(aspect) ? Math.max(0.1, aspect) : 1;
  const angle = Number.isFinite(fov) && fov > 0 ? Math.min(100, fov) : 32;
  const spans: Record<string, readonly [number, number]> = {
    face: [0.3, 0.23],
    kit: [0.45, 0.5],
    legs: [0.6, 0.54],
    boots: [0.4, 0.25],
    hands: [0.67, 0.35],
    body: groundAction ? [1.65, 0.92] : overhead ? [0.95, 1.55] : [0.7, 1.28],
  };
  const [width, tall] = spans[framing] ?? spans["body"]!;
  const tangent = Math.tan((angle * Math.PI) / 360);
  const distance = Math.max((h * tall) / (2 * tangent), (h * width) / (2 * tangent * ratio));
  return {
    distance: distance * 1.08,
    minDistance: Math.max(0.25, distance * 0.42),
    maxDistance: Math.max(3, distance * 2.4),
  };
}
