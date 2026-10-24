import type { SimPlayer } from "./sim-types";
import type { Tactics } from "./types";
import { FIELD_X, FIELD_Z, staminaDrainMult, type WeatherKind } from "./sim-rules";
import { athleteContact } from "./athlete-dynamics";
import { tacticalEffects } from "./tactical-plan";

export function clampFinite(value: number, lower: number, upper: number, fallback: number): number {
  if (!Number.isFinite(value)) value = fallback;
  return value <= lower ? lower : value >= upper ? upper : value;
}

/** Contact order and RNG consumption are part of the simulation contract. */
export function separatePlayers(players: SimPlayer[], holder: string | null, rnd: () => number) {
  const R = 0.85; // raio do corpo
  const list = players;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      // Resolve contacts in the original order; only reject provably distant pairs.
      // NaN must reach the original recovery path instead of being hidden by the rejection.
      if ((dx > 1.7 || dx < -1.7) && !Number.isNaN(dz)) continue;
      const d2 = dx * dx + dz * dz;
      if (d2 > 2.89) continue; // (0.85 * 2)^2
      let d = Math.sqrt(d2);
      if (d > R * 2) continue;
      if (d < 1e-4) {
        dx = (rnd() - 0.5) * 0.02;
        dz = (rnd() - 0.5) * 0.02;
        d = Math.hypot(dx, dz) || 1e-4;
      }
      const overlap = R * 2 - d;
      // Quem conduz a bola cede menos, mas a soma dos deslocamentos sempre
      // resolve toda a sobreposição para não deixar atletas grudados.
      const aWeight = a.id === holder ? 0.25 : 1;
      const bWeight = b.id === holder ? 0.25 : 1;
      const totalWeight = aWeight + bWeight;
      const nx = dx / d;
      const nz = dz / d;
      athleteContact(a, b, nx, nz);
      a.x -= nx * overlap * (aWeight / totalWeight);
      a.z -= nz * overlap * (aWeight / totalWeight);
      b.x += nx * overlap * (bWeight / totalWeight);
      b.z += nz * overlap * (bWeight / totalWeight);
    }
  }
  for (const p of list) {
    p.x = Math.max(-FIELD_X - 1, Math.min(FIELD_X + 1, p.x));
    p.z = Math.max(-FIELD_Z - 1, Math.min(FIELD_Z + 1, p.z));
  }
}
export function drainMatchStamina(
  players: SimPlayer[],
  home: Tactics,
  away: Tactics,
  weather: WeatherKind,
  dt: number,
) {
  const climate = staminaDrainMult(weather);
  const costs = {
    home: home.advanced ? tacticalEffects(home).fatigue : 1,
    away: away.advanced ? tacticalEffects(away).fatigue : 1,
  };
  for (const p of players) {
    const speed = Math.hypot(p.vx, p.vz);
    const effort = 0.0015 + (speed / 9) * 0.008 * (p.pos === "GK" ? 0.25 : 1);
    const resist = 0.6 + (p.physical / 100) * 0.6;
    const cost = costs[p.side];
    p.stamina = Math.max(12, p.stamina - ((effort * climate * cost) / resist) * dt);
  }
}
export function sanitizeMotion(
  players: SimPlayer[],
  ball: { x: number; z: number; vx: number; vz: number; height: number },
) {
  for (const p of players) {
    p.x = clampFinite(p.x, -FIELD_X - 1, FIELD_X + 1, 0);
    p.z = clampFinite(p.z, -FIELD_Z - 1, FIELD_Z + 1, 0);
    p.vx = clampFinite(p.vx, -14, 14, 0);
    p.vz = clampFinite(p.vz, -14, 14, 0);
    p.stamina = clampFinite(p.stamina, 0, 100, 70);
  }
  const b = ball;
  b.x = clampFinite(b.x, -FIELD_X - 2, FIELD_X + 2, 0);
  b.z = clampFinite(b.z, -FIELD_Z - 2, FIELD_Z + 2, 0);
  b.vx = clampFinite(b.vx, -45, 45, 0);
  b.vz = clampFinite(b.vz, -45, 45, 0);
  b.height = clampFinite(b.height, 0.1, 12, 0.12);
}
