import type { SimView } from "./sim-types";
import type { SupporterMatchday } from "./career-world-types";

export type CrowdBehavior = "chant" | "celebrate" | "boo" | "gasp" | "wave" | "taunt";
export function createCrowdBehavior() {
  return {
    behavior: "chant" as CrowdBehavior,
    intensity: 0.12,
    side: "home" as "home" | "away",
    age: 0,
    initialized: false,
    homeGoals: 0,
    awayGoals: 0,
    homeShots: 0,
    awayShots: 0,
    homeCards: 0,
    awayCards: 0,
    homeFouls: 0,
    awayFouls: 0,
    supporterClimate: null as SupporterMatchday["climate"] | null,
  };
}
/** Presentation only. Compare new counters, never infer an event from totals. */
export function advanceCrowdBehavior(
  state: ReturnType<typeof createCrowdBehavior>,
  sim: SimView,
  dt: number,
  supporters?: SupporterMatchday,
) {
  const h = sim.stats.home,
    a = sim.stats.away;
  const hc = h.yellow + h.red * 2,
    ac = a.yellow + a.red * 2;
  if (state.initialized) {
    let next: CrowdBehavior | null = null,
      strength = 0,
      side = state.side;
    if (h.goals > state.homeGoals || a.goals > state.awayGoals) {
      next = "celebrate";
      strength = 1;
      side = h.goals > state.homeGoals ? "home" : "away";
    } else if (h.onTarget > state.homeShots || a.onTarget > state.awayShots) {
      next = "gasp";
      strength = 0.65;
      side = h.onTarget > state.homeShots ? "home" : "away";
    } else if (
      hc > state.homeCards ||
      ac > state.awayCards ||
      h.fouls > state.homeFouls ||
      a.fouls > state.awayFouls
    ) {
      next = "boo";
      strength = hc > state.homeCards || ac > state.awayCards ? 0.7 : 0.4;
      side = hc > state.homeCards || h.fouls > state.homeFouls ? "away" : "home";
    }
    const trailing = supporters?.side === "home" ? h.goals < a.goals : a.goals < h.goals;
    if (
      !next &&
      supporters &&
      supporters.climate !== state.supporterClimate &&
      (supporters.climate === "protesto" || (supporters.climate === "cobrança" && trailing))
    ) {
      next = "boo";
      strength = Math.min(0.8, Math.max(0.3, supporters.intensity));
      side = supporters.side;
    }
    if (
      next &&
      (state.behavior !== "celebrate" || next === "celebrate" || state.intensity < 0.25)
    ) {
      state.behavior = next;
      state.intensity = strength;
      state.side = side;
      state.age = 0;
    }
  }
  state.initialized = true;
  state.homeGoals = h.goals;
  state.awayGoals = a.goals;
  state.homeShots = h.onTarget;
  state.awayShots = a.onTarget;
  state.homeCards = hc;
  state.awayCards = ac;
  state.homeFouls = h.fouls;
  state.awayFouls = a.fouls;
  state.supporterClimate = supporters?.climate ?? null;
  state.age += Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
  if (state.behavior !== "chant" && state.behavior !== "wave" && state.behavior !== "taunt")
    state.intensity = Math.max(
      0,
      state.intensity -
        Math.min(0.1, Math.max(0, dt || 0)) * (state.behavior === "celebrate" ? 0.12 : 0.35),
    );
  if (state.intensity < 0.06 || state.age > 12) {
    const minute = sim.minute();
    const side = supporters?.side ?? "home";
    const leading = side === "home" ? h.goals > a.goals : a.goals > h.goals;
    const protest =
      supporters?.climate === "protesto" || (supporters?.climate === "cobrança" && !leading);
    state.behavior = protest
      ? "boo"
      : leading && minute % 12 < 2
        ? "taunt"
        : minute > 0 && minute % 18 < 2
          ? "wave"
          : "chant";
    state.side = side;
    state.intensity = protest ? 0.35 : state.behavior === "chant" ? 0.15 : 0.55;
    state.age = 0;
  }
  return state;
}

/** Two articulated arm segments share the supporter's existing draw. All
 * phases come from seat coordinates, so no spectator animation loop runs on CPU. */
export const CROWD_MOTION_GLSL = `
attribute vec2 crowdLimb;
vec3 crowdBodyScale() {
  return vec3(mix(0.82, 1.18, crowdStyle.x), 1.0, mix(0.84, 1.16, crowdStyle.y));
}
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
  float clap = step(0.34, crowdStyle.y) * (1.0 - step(0.72, crowdStyle.y));
  // Neighbouring seats share a chant tempo; identities vary reach and timing.
  float beat = 0.5 + 0.5 * sin(crowdTime * 5.6 + floor(phase * 0.08) * 0.7);
  float responseAge = max(0.0, crowdEventAge - crowdStyle.x * 0.22);
  float attack = smoothstep(0.0, 0.32, responseAge);
  float waveAngle = atan(instanceMatrix[3].z, instanceMatrix[3].x);
  float waveDistance = abs(mod(waveAngle - crowdWave + 3.14159265, 6.2831853) - 3.14159265);
  float ola = exp(-waveDistance * waveDistance * 5.0) * crowdWaveStrength;
  float energy = clamp(max(crowdPulse, crowdEnergy) * attack + ola, 0.0, 1.0);
  float raise = energy * (0.82 + 0.18 * sin(crowdTime * 2.0 + phase));
  float chant = crowdChant * (0.35 + beat * 0.65);
  float surprise = crowdSurprise * attack;
  float shoulderZ = side * (0.06 * sin(crowdTime * 1.1 + phase) + raise * mix(2.65, 0.35, clap));
  float shoulderX = -clap * (0.35 + chant * 0.9 + energy * 0.7);
  // Gasp: both hands to temples; protest: an asymmetric forward point.
  shoulderZ += side * surprise * 1.9;
  shoulderX -= surprise * 0.38;
  shoulderX -= crowdProtest * (0.55 + 0.25 * beat) * (side > 0.0 ? 1.0 : 0.4);
  float elbowX = -clap * (0.45 + chant * 1.2 + energy * (0.55 + beat * 0.52)) - surprise * 1.0;
  float elbowZ = -side * (energy * (0.25 + clap * beat * 0.2) + surprise * 0.9);
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
// Shear is applied after articulated rotation/scale; normals use its inverse
// transpose rather than retaining the upright torso lighting during a gasp.
vec2 crowdShear() {
  float phase = instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
  float response = smoothstep(0.0, 0.32, max(0.0, crowdEventAge - crowdStyle.x * 0.22));
  return vec2(sin(crowdTime * 1.7 + phase) * 0.035,
    crowdSurprise * response * 0.12 + sin(crowdTime * 5.2 + phase) * crowdAgitation * 0.05);
}
vec3 crowdShearNormal(vec3 n) {
  vec3 p = crowdArticulate(position, false) * crowdBodyScale();
  vec2 shear = crowdShear() * step(-0.55, p.y);
  n.y -= dot(shear, n.xz);
  return n;
}
`;
