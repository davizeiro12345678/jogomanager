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
