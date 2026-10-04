/**
 * Autocorreção segura de um save carregado. Só conserta o que tem resposta
 * óbvia (valores fora da faixa, ids órfãos, partidas duplicadas); nunca inventa
 * resultados nem altera o que o jogador decidiu. Pura e determinística.
 */
import type {
  CareerState,
  FinanceLedgerEntry,
  Fixture,
  OperatingPlan,
  Player,
  TrainingReport,
} from "./types";
import {
  repairPlayerIdentities,
  repairShirtNumbers,
  remapPlayerReferences,
} from "./player-roster-repair";

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizedPlan(value: unknown): { plan: OperatingPlan | undefined; changed: boolean } {
  if (value === undefined) return { plan: undefined, changed: false };
  const source = isRecord(value) ? value : {};
  const plan: OperatingPlan = {
    academy: Math.round(clamp(source["academy"], 0, 3, 1)) as OperatingPlan["academy"],
    medical: Math.round(clamp(source["medical"], 0, 3, 1)) as OperatingPlan["medical"],
    scouting: Math.round(clamp(source["scouting"], 0, 3, 1)) as OperatingPlan["scouting"],
    commercial: Math.round(clamp(source["commercial"], 0, 3, 1)) as OperatingPlan["commercial"],
  };
  const changed =
    !isRecord(value) ||
    source["academy"] !== plan.academy ||
    source["medical"] !== plan.medical ||
    source["scouting"] !== plan.scouting ||
    source["commercial"] !== plan.commercial;
  return { plan, changed };
}

function normalizedLedger(value: unknown): {
  entries: FinanceLedgerEntry[] | undefined;
  dropped: number;
} {
  if (value === undefined) return { entries: undefined, dropped: 0 };
  if (!Array.isArray(value)) return { entries: [], dropped: 1 };
  const seen = new Set<string>();
  let dropped = 0;
  const entries: FinanceLedgerEntry[] = [];
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw["id"] !== "string" || !raw["id"] || seen.has(raw["id"])) {
      dropped++;
      continue;
    }
    const validKind = ["operacao", "mercado", "infraestrutura", "premio"].includes(
      String(raw["kind"]),
    );
    if (!validKind || typeof raw["label"] !== "string") {
      dropped++;
      continue;
    }
    seen.add(raw["id"]);
    entries.push({
      id: raw["id"],
      season: Math.round(clamp(raw["season"], 1, 999, 1)),
      round: Math.round(clamp(raw["round"], 1, 999, 1)),
      kind: raw["kind"] as FinanceLedgerEntry["kind"],
      label: raw["label"].slice(0, 160),
      income: clamp(raw["income"], 0, 1e6, 0),
      expense: clamp(raw["expense"], 0, 1e6, 0),
    });
  }
  return { entries: entries.slice(0, 96), dropped: dropped + Math.max(0, entries.length - 96) };
}

function normalizedTrainingReports(value: unknown): {
  reports: TrainingReport[] | undefined;
  dropped: number;
} {
  if (value === undefined) return { reports: undefined, dropped: 0 };
  if (!Array.isArray(value)) return { reports: [], dropped: 1 };
  let dropped = 0;
  const seen = new Set<string>();
  const reports: TrainingReport[] = [];
  for (const raw of value) {
    if (
      !isRecord(raw) ||
      typeof raw["id"] !== "string" ||
      !raw["id"] ||
      seen.has(raw["id"]) ||
      typeof raw["drillId"] !== "string"
    ) {
      dropped++;
      continue;
    }
    seen.add(raw["id"]);
    reports.push({
      id: raw["id"],
      season: Math.round(clamp(raw["season"], 1, 999, 1)),
      round: Math.round(clamp(raw["round"], 1, 999, 1)),
      drillId: raw["drillId"].slice(0, 80),
      load: Math.round(clamp(raw["load"], 0, 100, 0)),
      recovery: Math.round(clamp(raw["recovery"], 0, 100, 0)),
      responders: Array.isArray(raw["responders"])
        ? raw["responders"].filter((name): name is string => typeof name === "string").slice(0, 8)
        : [],
    });
  }
  return { reports: reports.slice(0, 24), dropped: dropped + Math.max(0, reports.length - 24) };
}

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
  let badIds = 0;
  const declaredIds = new Map<string, string>();
  let players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(input.players ?? {})) {
    if (!p || typeof p !== "object") continue;
    if (typeof p.id === "string" && p.id.trim()) declaredIds.set(id, p.id.trim());
    if (p.id !== id) badIds++;
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
  if (badIds) fixes.push(`${badIds} ID(s) de jogadores inconsistentes corrigido(s)`);

  const lineupWasValid =
    Array.isArray(input.lineup) && input.lineup.every((id) => typeof id === "string");
  const benchWasValid =
    Array.isArray(input.bench) && input.bench.every((id) => typeof id === "string");
  const identityLineup = Array.isArray(input.lineup)
    ? input.lineup.filter((id): id is string => typeof id === "string")
    : [];
  const identityBench = Array.isArray(input.bench)
    ? input.bench.filter((id): id is string => typeof id === "string")
    : [];
  if (!lineupWasValid || !benchWasValid)
    input = { ...input, lineup: identityLineup, bench: identityBench };

  const identity = repairPlayerIdentities(players, identityLineup, declaredIds);
  const removedPlayers = Object.keys(players).length - Object.keys(identity.players).length;
  for (const [key, declared] of declaredIds) {
    if (key !== declared && !players[declared])
      identity.aliases.set(declared, identity.aliases.get(key) ?? key);
  }
  players = identity.players;
  if (identity.aliases.size) {
    if (removedPlayers)
      fixes.push(`${removedPlayers} cópia(s) de jogadores com a mesma identidade removida(s)`);
    input = remapPlayerReferences(input, identity.aliases);
  }
  const shirts = repairShirtNumbers(players);
  players = shirts.players;
  if (shirts.changed)
    fixes.push(`${shirts.changed} número(s) de camisa repetido(s) ou inválido(s) corrigido(s)`);

  // 2. escalação e banco: sem ids órfãos, sem repetição, banco sem titulares
  const own = (id: string) => players[id]?.clubId === input.clubId;
  const rawLineup = input.lineup;
  const rawBench = input.bench;
  const uniq = (ids: string[]) => [...new Set(ids)].filter(own);
  const lineup = uniq(rawLineup).slice(0, 11);
  let bench = uniq(rawBench).filter((id) => !lineup.includes(id));
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
  if (
    lineup.join() !== rawLineup.join() ||
    bench.join() !== rawBench.join() ||
    !lineupWasValid ||
    !benchWasValid
  )
    fixes.push("Escalação com jogadores inexistentes ou repetidos");

  // 3. calendário: sem partidas duplicadas, contra si mesmo ou com placar pela metade
  const seen = new Set<string>();
  let dropped = 0;
  let halfScores = 0;
  const rawFixtures = Array.isArray(input.fixtures) ? input.fixtures : [];
  if (!Array.isArray(input.fixtures)) dropped++;
  const fixtures = rawFixtures.flatMap((raw): Fixture[] => {
    if (
      !isRecord(raw) ||
      !Number.isInteger(raw["round"]) ||
      typeof raw["home"] !== "string" ||
      !raw["home"] ||
      typeof raw["away"] !== "string" ||
      !raw["away"]
    ) {
      dropped++;
      return [];
    }
    const f = raw as unknown as Fixture;
    const key = `${f.round}:${f.home}:${f.away}`;
    if (f.home === f.away || seen.has(key)) {
      dropped++;
      return [];
    }
    seen.add(key);
    const homePending = f.homeGoals == null;
    const awayPending = f.awayGoals == null;
    const homeScoreValid = homePending || (Number.isInteger(f.homeGoals) && f.homeGoals! >= 0);
    const awayScoreValid = awayPending || (Number.isInteger(f.awayGoals) && f.awayGoals! >= 0);
    if (!homeScoreValid || !awayScoreValid || homePending !== awayPending) {
      halfScores++;
      const { events: _events, ...rest } = f;
      return [{ ...rest, homeGoals: null, awayGoals: null }];
    }
    return [
      {
        ...f,
        homeGoals: homePending ? null : f.homeGoals,
        awayGoals: awayPending ? null : f.awayGoals,
      },
    ];
  });
  if (dropped) fixes.push(`${dropped} partida(s) inválida(s) ou duplicada(s) removida(s)`);
  if (halfScores) fixes.push(`${halfScores} placar(es) incompleto(s) reaberto(s)`);

  // 4. resultados repetidos
  const seenRes = new Set<string>();
  const rawResults = Array.isArray(input.results) ? input.results : [];
  const validResults = rawResults.filter(
    (result): result is CareerState["results"][number] =>
      isRecord(result) &&
      Number.isInteger(result.round) &&
      typeof result.home === "string" &&
      !!result.home &&
      typeof result.away === "string" &&
      !!result.away &&
      Number.isInteger(result.hg) &&
      Number.isInteger(result.ag) &&
      (result.hg as number) >= 0 &&
      (result.ag as number) >= 0,
  );
  let malformedResults = rawResults.length - validResults.length;
  if (!Array.isArray(input.results)) malformedResults++;
  const results = validResults.filter((r) => {
    const k = `${r.round}:${r.home}:${r.away}`;
    if (seenRes.has(k)) return false;
    seenRes.add(k);
    return true;
  });
  if (malformedResults || results.length !== rawResults.length)
    fixes.push("Resultados inválidos ou repetidos removidos do histórico");

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

  const planResult = normalizedPlan((input as unknown as Record<string, unknown>)["operatingPlan"]);
  const ledgerResult = normalizedLedger(
    (input as unknown as Record<string, unknown>)["financeLedger"],
  );
  const trainingResult = normalizedTrainingReports(
    (input as unknown as Record<string, unknown>)["trainingReports"],
  );
  if (planResult.changed) fixes.push("Plano operacional com valores inválidos corrigido");
  if (
    ledgerResult.dropped ||
    JSON.stringify(input.financeLedger) !== JSON.stringify(ledgerResult.entries)
  )
    fixes.push("Lançamentos financeiros inválidos corrigidos");
  if (
    trainingResult.dropped ||
    JSON.stringify(input.trainingReports) !== JSON.stringify(trainingResult.reports)
  )
    fixes.push("Relatórios de treino inválidos corrigidos");

  if (!fixes.length) return { state: input, fixes };
  return {
    state: {
      ...input,
      players,
      lineup,
      bench,
      fixtures,
      results,
      finances,
      ...meters,
      ...(planResult.plan !== undefined ? { operatingPlan: planResult.plan } : {}),
      ...(ledgerResult.entries !== undefined ? { financeLedger: ledgerResult.entries } : {}),
      ...(trainingResult.reports !== undefined ? { trainingReports: trainingResult.reports } : {}),
    },
    fixes,
  };
}
