/** Two articulated arm segments share the supporter's existing draw. All
 * phases come from seat coordinates, so no spectator animation loop runs on CPU. */
export const CROWD_MOTION_GLSL = `
attribute vec2 crowdLimb;
vec3 crowdRotate(vec3 v, float z, float x) {
  float cz = cos(z), sz = sin(z), cx = cos(x), sx = sin(x);
  v.xy = mat2(cz, sz, -sz, cz) * v.xy;
  v.yz = mat2(cx, sx, -sx, cx) * v.yz;
  return v;
}
vec3 crowdArticulate(vec3 v, bool normalOnly) {
  if (crowdLimb.y < 0.5) return v;
  float side = crowdLimb.x;
  float phase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
  float clap = step(0.34, crowdStyle.y) * (1.0 - step(0.68, crowdStyle.y));
  float beat = 0.5 + 0.5 * sin(crowdTime * (4.2 + crowdStyle.x * 1.4) + phase);
  float energy = clamp(crowdPulse, 0.0, 1.0);
  float raise = energy * (0.72 + 0.28 * sin(crowdTime * 2.0 + phase));
  float shoulderZ = side * (0.08 * sin(crowdTime * 1.1 + phase) + raise * mix(2.55, 0.2, clap));
  float shoulderX = -clap * (0.36 + energy * 0.8);
  float elbowX = -clap * (0.42 + energy * (0.55 + beat * 0.52));
  float elbowZ = -side * energy * mix(0.25, 0.25 + beat * 0.2, clap);
  vec3 shoulder = vec3(side * 0.21, 0.25, 0.0);
  vec3 elbow = vec3(side * 0.245, 0.025, 0.0);
  if (crowdLimb.y > 1.5) {
    if (!normalOnly) v -= elbow;
    v = crowdRotate(v, elbowZ, elbowX);
    if (!normalOnly) v += elbow;
  }
  if (!normalOnly) v -= shoulder;
  v = crowdRotate(v, shoulderZ, shoulderX);
  if (!normalOnly) v += shoulder;
  return v;
}
`;
