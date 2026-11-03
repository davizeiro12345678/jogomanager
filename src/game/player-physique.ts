import { makeRng } from "./rng";
import type { Player, Position } from "./types";

/** Mesma identidade física da ficha completa, sem carregar históricos ou o catálogo. */
export function physiqueFor(player: Player): { height: number; weight: number } {
  if (player.developmentBase?.profile)
    return {
      height: player.developmentBase.profile.height,
      weight: player.developmentBase.profile.weight,
    };
  const rnd = makeRng(`profile-${player.id}-${player.name}`);
  // The legacy attribute schema consumes exactly 29 identity draws. Only
  // advance that stream here; constructing its unused attributes also creates
  // a second RNG and dozens of temporary values for every athlete.
  for (let draw = 0; draw < 29; draw++) rnd();
  // O pé dominante consome uma ou duas amostras antes das medidas na ficha.
  if (rnd() >= 0.72) rnd();
  return bodyMeasurements(player.pos, rnd);
}

/** Continue an identity stream after its foot draw without reseeding it. */
export function bodyMeasurements(pos: Position, rnd: () => number) {
  const tall = pos === "GK" ? 8 : pos === "DF" ? 4 : 0;
  return {
    height: Math.round(171 + tall + rnd() * 16),
    weight: Math.round(65 + tall * 0.9 + rnd() * 18),
  };
}
