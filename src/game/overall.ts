/**
 * Overall algorítmico dos atletas importados.
 *
 * Overall = força da liga + força do clube + fator posição + curva de idade
 *         + estatísticas + minutagem/eventos + pequena variação individual.
 *
 * Função pura e determinística (mesma entrada → mesmo número), para que uma
 * re-sincronização não mude o jogador sem motivo.
 */
import { makeRng } from "./rng";

export type OverallPosition = "GK" | "DF" | "MF" | "FW";

export interface OverallInput {
  seed: string;
  /** Tier da liga: 1 = primeira divisão. */
  leagueTier: number;
  /** Força do clube no jogo (40–95). */
  clubStrength: number;
  position: OverallPosition;
  age: number | null;
  stats?: {
    appearances?: number;
    minutes?: number;
    goals?: number;
    assists?: number;
    cleanSheets?: number;
    rating?: number | null;
  };
}

export interface OverallBreakdown {
  league: number;
  club: number;
  position: number;
  age: number;
  stats: number;
  minutes: number;
  variation: number;
  overall: number;
  potential: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Primeira divisão pesa mais; cada divisão abaixo tira pontos. */
export function leagueComponent(tier: number): number {
  return clamp(8 - (Math.max(1, tier) - 1) * 4, -6, 8);
}

/** Pico entre 26 e 30; jovens e veteranos perdem um pouco. */
export function ageComponent(age: number | null): number {
  if (age == null) return 0;
  if (age < 19) return -5;
  if (age < 23) return -2 - (23 - age) * 0.5 + 2;
  if (age <= 30) return age >= 26 ? 2 : 1;
  if (age <= 33) return 0;
  return -Math.min(6, (age - 33) * 1.5);
}

export function computeOverall(input: OverallInput): OverallBreakdown {
  const league = leagueComponent(input.leagueTier);
  const club = clamp(input.clubStrength, 40, 95) * 0.72;
  const position = input.position === "GK" ? -1 : input.position === "FW" ? 0.5 : 0;
  const age = ageComponent(input.age);

  const s = input.stats ?? {};
  const apps = Math.max(0, s.appearances ?? 0);
  let stats = 0;
  if (apps > 0) {
    const perGame =
      input.position === "FW" || input.position === "MF"
        ? ((s.goals ?? 0) + (s.assists ?? 0) * 0.7) / apps
        : input.position === "GK" || input.position === "DF"
          ? (s.cleanSheets ?? 0) / apps
          : 0;
    stats += clamp(perGame * (input.position === "FW" ? 6 : 5), 0, 4);
  }
  if (s.rating != null) stats += clamp((s.rating - 6.6) * 3, -3, 3);

  const minutes = clamp(((s.minutes ?? 0) / 2700) * 3, 0, 3);
  const rng = makeRng(`ovr:${input.seed}`);
  const variation = Math.round((rng() * 6 - 3) * 10) / 10;

  const raw = 12 + league + club + position + age + stats + minutes + variation;
  const overall = Math.round(clamp(raw, 40, 94));
  const growth = input.age != null && input.age < 24 ? (24 - input.age) * 1.5 : 0;
  const potential = Math.round(clamp(overall + growth, overall, 96));

  return { league, club, position, age, stats, minutes, variation, overall, potential };
}

// ---------------------------------------------------------------------------
// Overall por atributos e potencial (usado pela base, regens e evolução)
// ---------------------------------------------------------------------------

export interface CoreAttributes {
  pace: number;
  shooting: number;
  passing: number;
  defending: number;
  physical: number;
}

/** Peso de cada atributo por posição (cada linha soma 1). */
export const POSITION_WEIGHTS: Record<OverallPosition, CoreAttributes> = {
  GK: { pace: 0.05, shooting: 0, passing: 0.15, defending: 0.6, physical: 0.2 },
  DF: { pace: 0.15, shooting: 0.03, passing: 0.15, defending: 0.45, physical: 0.22 },
  MF: { pace: 0.15, shooting: 0.17, passing: 0.38, defending: 0.15, physical: 0.15 },
  FW: { pace: 0.25, shooting: 0.42, passing: 0.13, defending: 0.02, physical: 0.18 },
};

/** Overall a partir dos atributos, ponderado pela posição. */
export function positionalOverall(pos: OverallPosition, a: CoreAttributes): number {
  const w = POSITION_WEIGHTS[pos];
  const v =
    a.pace * w.pace +
    a.shooting * w.shooting +
    a.passing * w.passing +
    a.defending * w.defending +
    a.physical * w.physical;
  return Math.round(clamp(v, 30, 99));
}

/** Ajuste de forma recente: forma 50 é neutra, ±2 no máximo. */
export function formAdjustment(form: number): number {
  return Math.round(clamp((form - 60) / 15, -2, 2) * 10) / 10;
}

/**
 * Potencial: jovens com minutos crescem mais; a partir dos 29 o potencial é
 * o próprio overall. `minutesShare` = fração dos minutos possíveis (0–1).
 */
export function potentialFor(
  ovr: number,
  age: number,
  minutesShare: number,
  seed: string,
): number {
  if (age >= 29) return ovr;
  const rng = makeRng(`pot:${seed}`);
  const years = 29 - age;
  const perYear = age < 21 ? 2.4 : age < 24 ? 1.6 : 0.8;
  const playBonus = clamp(minutesShare, 0, 1) * 4;
  const talent = rng() * 8 - 3;
  return Math.round(clamp(ovr + years * perYear * 0.6 + playBonus + talent, ovr, 96));
}
