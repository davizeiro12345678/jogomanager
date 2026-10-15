import type { Player } from "./types";
import { finiteAmount, safeMoney, wageToEuros } from "./financial-inputs";

/** Linear interpolation with clamped extremes avoids age/contract boundary cliffs. */
export function interpolateAnchors(
  value: number,
  anchors: readonly (readonly [number, number])[],
): number {
  if (value <= anchors[0]![0]) return anchors[0]![1];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i]!;
    const [previousX, previousY] = anchors[i - 1]!;
    if (value <= x) return previousY + ((y - previousY) * (value - previousX)) / (x - previousX);
  }
  return anchors[anchors.length - 1]![1];
}

export interface MarketValueContext {
  economyRulesVersion?: 1 | 2 | undefined;
  potential?: number | undefined;
  contractYears?: number | undefined;
}

/** Valor de mercado em milhões de euros. */
export function valueFor(ovr: number, age: number, context: MarketValueContext = {}): number {
  ovr = Number.isFinite(ovr) ? Math.max(0, Math.min(99, ovr)) : 52;
  age = Number.isFinite(age) ? Math.max(0, age) : 30;
  const base = Math.pow(Math.max(0, ovr - 52), 2.15) / 55;
  if (context.economyRulesVersion === 2) {
    const factor = interpolateAnchors(age, [
      [18, 1.5],
      [21, 1.5],
      [27, 1.35],
      [30, 1],
      [33, 0.55],
      [36, 0.25],
    ]);
    const potential = Number.isFinite(context.potential) ? context.potential! : ovr;
    const bonus = 1 + Math.min(0.12, Math.max(0, potential - ovr) * 0.01);
    const years = Number.isFinite(context.contractYears) ? context.contractYears! : 2;
    const contract = interpolateAnchors(years, [
      [0, 0.9],
      [1, 0.95],
      [2, 1],
      [4, 1.05],
    ]);
    return safeMoney(Math.max(0.3, base * factor * bonus * contract));
  }
  const ageFactor = age <= 21 ? 1.5 : age <= 27 ? 1.35 : age <= 30 ? 1 : age <= 33 ? 0.55 : 0.25;
  return Math.round(Math.max(0.3, base * ageFactor) * 10) / 10;
}

/** Salário semanal em milhares de euros. */
export function wageFor(ovr: number): number {
  ovr = Number.isFinite(ovr) ? Math.max(0, Math.min(99, ovr)) : 48;
  return Math.round(Math.max(2, Math.pow(Math.max(1, ovr - 48), 1.85) * 0.55));
}

/** Folha salarial semanal total (k€). */
export function wageBill(players: Player[]): number {
  return (
    players.reduce((s, p) => s + (p && finiteAmount(p.wage) ? wageToEuros(p.wage) : 0), 0) / 1000
  );
}

/** Parcela recorrente de TV, sem bilheteria nem bônus de resultado. */
export function broadcastIncome(clubStrength: number): number {
  clubStrength = Number.isFinite(clubStrength) ? Math.min(100, clubStrength) : 0;
  return Math.round(Math.max(0, clubStrength) * 0.011 * 100) / 100;
}

/** Bônus de desempenho só existe quando houve uma partida. */
export function performanceIncome(won: boolean): number {
  return won ? 0.05 : 0.015;
}

/** Receita semanal do clube (M€): bilheteria + TV + prêmios de performance. */
export function weeklyIncome(clubStrength: number, position: number, won: boolean): number {
  position = Number.isFinite(position) ? Math.max(1, Math.min(21, position)) : 21;
  const base = broadcastIncome(clubStrength);
  const gate = Math.max(0, (21 - position) * 0.006);
  return Math.round((base + gate + performanceIncome(won)) * 100) / 100;
}

/** Prêmio de fim de temporada por posição (M€). */
export function seasonPrize(position: number, clubStrength: number): number {
  position = Number.isFinite(position) ? Math.max(1, Math.min(21, position)) : 21;
  clubStrength = Number.isFinite(clubStrength) ? Math.max(0, Math.min(100, clubStrength)) : 0;
  const scale = clubStrength * 0.06;
  return Math.round(Math.max(0.5, scale * (21 - position)) * 10) / 10;
}

export function formatMoney(v: number, decimals = 1, locale = "pt-BR"): string {
  return `€${v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}M`;
}

export function formatWage(v: number, locale = "pt-BR"): string {
  return `€${v.toLocaleString(locale)}k/${locale.startsWith("pt") ? "sem" : "week"}`;
}
