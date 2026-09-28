/**
 * Autocorreção segura de um save carregado. Só conserta o que tem resposta
 * óbvia (valores fora da faixa, ids órfãos, partidas duplicadas); nunca inventa
 * resultados nem altera o que o jogador decidiu. Pura e determinística.
 */
import type { CareerState, Fixture, Player } from "./types";

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
};

const PLAYER_RANGES: [keyof Player, number, number, number][] = [
  ["ovr", 1, 99, 60],
  ["pace", 1, 99, 60],
  ["shooting", 1, 99, 60],
  ["passing", 1, 99, 60],
  ["defending", 1, 99, 60],
  ["physical", 1, 99, 60],
  ["condition", 0, 100, 100],
  ["morale", 0, 100, 70],
  ["age", 15, 45, 25],
  ["goals", 0, 9999, 0],
  ["assists", 0, 9999, 0],
  ["apps", 0, 9999, 0],
  ["yellows", 0, 99, 0],
  ["injuryWeeks", 0, 52, 0],
  ["wage", 0, 100000, 1],
  ["value", 0, 100000, 0.1],
];

export interface RepairResult {
  state: CareerState;
  fixes: string[];
}

export function repairCareer(input: CareerState): RepairResult {
  const fixes: string[] = [];

  // 1. atributos de jogadores dentro da faixa válida
  let badPlayers = 0;
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(input.players ?? {})) {
    if (!p) continue;
    const next = { ...p, id };
    let changed = false;
    for (const [key, min, max, fb] of PLAYER_RANGES) {
      const cur = p[key];
      const val = clamp(cur, min, max, fb);
      if (cur !== val) {
        (next as Record<string, unknown>)[key] = val;
        changed = true;
      }
    }
    if (changed) badPlayers++;
    players[id] = next;
  }
  if (badPlayers) fixes.push(`${badPlayers} jogador(es) com atributos fora da faixa`);

  // 2. escalação e banco: sem ids órfãos, sem repetição, banco sem titulares
  const own = (id: string) => players[id]?.clubId === input.clubId;
  const uniq = (ids: string[]) => [...new Set(ids)].filter(own);
  const lineup = uniq(input.lineup ?? []).slice(0, 11);
  let bench = uniq(input.bench ?? []).filter((id) => !lineup.includes(id));
  if (lineup.length < 11) {
    const pool = Object.values(players)
      .filter(
        (p) =>
          p.clubId === input.clubId &&
          !lineup.includes(p.id) &&
          !p.suspended &&
          p.injuryWeeks === 0,
      )
      .sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id));
    for (const p of pool) {
      if (lineup.length >= 11) break;
      lineup.push(p.id);
    }
    bench = bench.filter((id) => !lineup.includes(id));
  }
  if (lineup.join() !== (input.lineup ?? []).join() || bench.join() !== (input.bench ?? []).join())
    fixes.push("Escalação com jogadores inexistentes ou repetidos");

  // 3. calendário: sem partidas duplicadas, contra si mesmo ou com placar pela metade
  const seen = new Set<string>();
  let dropped = 0;
  let halfScores = 0;
  const fixtures = (input.fixtures ?? []).flatMap((f): Fixture[] => {
    const key = `${f.round}:${f.home}:${f.away}`;
    if (f.home === f.away || seen.has(key)) {
      dropped++;
      return [];
    }
    seen.add(key);
    if ((f.homeGoals == null) !== (f.awayGoals == null)) {
      halfScores++;
      const { events: _events, ...rest } = f;
      return [{ ...rest, homeGoals: null, awayGoals: null }];
    }
    return [f];
  });
  if (dropped) fixes.push(`${dropped} partida(s) duplicada(s) removida(s)`);
  if (halfScores) fixes.push(`${halfScores} placar(es) incompleto(s) reaberto(s)`);

  // 4. resultados repetidos
  const seenRes = new Set<string>();
  const results = (input.results ?? []).filter((r) => {
    const k = `${r.round}:${r.home}:${r.away}`;
    if (seenRes.has(k)) return false;
    seenRes.add(k);
    return true;
  });
  if (results.length !== (input.results ?? []).length)
    fixes.push("Resultados repetidos no histórico");

  // 5. medidores e finanças
  const meters = {
    approval: clamp(input.approval, 0, 100, 62),
    fanApproval: clamp(input.fanApproval, 0, 100, 60),
    pressure: clamp(input.pressure, 0, 100, 30),
  };
  const f = input.finances;
  const finances = f
    ? {
        ...f,
        budget: clamp(f.budget, -1e6, 1e6, 0),
        spent: clamp(f.spent, 0, 1e6, 0),
        income: clamp(f.income, 0, 1e6, 0),
      }
    : f;
  if (
    meters.approval !== input.approval ||
    meters.fanApproval !== input.fanApproval ||
    meters.pressure !== input.pressure ||
    (f &&
      (finances!.budget !== f.budget ||
        finances!.spent !== f.spent ||
        finances!.income !== f.income))
  )
    fixes.push("Medidores ou finanças com valores inválidos");

  if (!fixes.length) return { state: input, fixes };
  return {
    state: { ...input, players, lineup, bench, fixtures, results, finances, ...meters },
    fixes,
  };
}
