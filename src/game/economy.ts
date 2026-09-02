import type { Player } from "./types";

/** Valor de mercado em milhões de euros. */
export function valueFor(ovr: number, age: number): number {
  const base = Math.pow(Math.max(0, ovr - 52), 2.15) / 55;
  const ageFactor = age <= 21 ? 1.5 : age <= 27 ? 1.35 : age <= 30 ? 1 : age <= 33 ? 0.55 : 0.25;
  return Math.round(Math.max(0.3, base * ageFactor) * 10) / 10;
}

/** Salário semanal em milhares de euros. */
export function wageFor(ovr: number): number {
  return Math.round(Math.max(2, Math.pow(Math.max(1, ovr - 48), 1.85) * 0.55));
}

/** Folha salarial semanal total (k€). */
export function wageBill(players: Player[]): number {
  return players.reduce((s, p) => s + p.wage, 0);
}

/** Receita semanal do clube (M€): bilheteria + TV + prêmios de performance. */
export function weeklyIncome(clubStrength: number, position: number, won: boolean): number {
  const base = clubStrength * 0.011;
  const gate = Math.max(0, (21 - position) * 0.006);
  const bonus = won ? 0.05 : 0.015;
  return Math.round((base + gate + bonus) * 100) / 100;
}

/** Prêmio de fim de temporada por posição (M€). */
export function seasonPrize(position: number, clubStrength: number): number {
  const scale = clubStrength * 0.06;
  return Math.round(Math.max(0.5, scale * (21 - position)) * 10) / 10;
}

export function formatMoney(v: number): string {
  return `€${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
}

export function formatWage(v: number): string {
  return `€${v.toLocaleString("pt-BR")}k/sem`;
}
