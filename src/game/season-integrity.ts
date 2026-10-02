/**
 * Verificações de integridade de uma temporada encerrada. Retorna a lista de
 * problemas encontrados (vazia = temporada consistente).
 */
import type { CupState, Fixture, TableRow } from "./types";

export interface SeasonCheckInput {
  clubIds: string[];
  fixtures: Fixture[];
  table: TableRow[];
  promoted?: string[];
  relegated?: string[];
  expectedPromoted?: number;
  expectedRelegated?: number;
  continentalQualified?: string[];
  cups?: CupState[];
  /** Competições em turno único mantêm a mesma verificação de pontos e resultados. */
  expectedGamesPerClub?: number;
}

export function checkSeasonIntegrity(input: SeasonCheckInput): string[] {
  const issues: string[] = [];
  const clubs = new Set(input.clubIds);
  if (clubs.size !== input.clubIds.length) issues.push("Clube duplicado na liga");

  const seen = new Set<string>();
  const perRound = new Map<string, Set<string>>();
  for (const f of input.fixtures) {
    const key = `${f.round}:${f.home}:${f.away}`;
    if (seen.has(key)) issues.push(`Partida duplicada: ${key}`);
    seen.add(key);
    if (f.home === f.away) issues.push(`Clube contra si mesmo: ${f.home}`);
    const round = perRound.get(String(f.round)) ?? new Set<string>();
    for (const c of [f.home, f.away]) {
      if (round.has(c))
        issues.push(`Calendário impossível: ${c} joga duas vezes na rodada ${f.round}`);
      round.add(c);
    }
    perRound.set(String(f.round), round);
  }

  const expectedGames = input.expectedGamesPerClub ?? (clubs.size - 1) * 2;
  for (const row of input.table) {
    if (!clubs.has(row.clubId)) issues.push(`Clube fora da liga na tabela: ${row.clubId}`);
    if (row.p !== expectedGames) issues.push(`${row.clubId} jogou ${row.p} de ${expectedGames}`);
    if (row.w + row.d + row.l !== row.p) issues.push(`${row.clubId}: V+E+D diferente de jogos`);
    if (row.pts !== row.w * 3 + row.d) issues.push(`${row.clubId}: pontos incorretos`);
  }

  if (input.expectedPromoted != null && (input.promoted?.length ?? 0) !== input.expectedPromoted)
    issues.push("Número de promovidos incorreto");
  if (input.expectedRelegated != null && (input.relegated?.length ?? 0) !== input.expectedRelegated)
    issues.push("Número de rebaixados incorreto");
  for (const id of input.continentalQualified ?? [])
    if (!clubs.has(id)) issues.push(`Classificado continental inexistente: ${id}`);
  for (const cup of input.cups ?? [])
    if (!cup.winner) issues.push(`Competição sem campeão: ${cup.name}`);

  return issues;
}
