/** Movimentação entre divisões da mesma pirâmide, sem alterar o catálogo global. */
import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import type { CareerState, TableRow } from "./types";
import { calendarYear, promotionRule, REGULATION_SOURCES } from "./competition-regulations";
import { competitionPlayoff, type CompetitionPlayoff } from "./competition-match";
import { simulateDivisionTable } from "./standings";
import { SERIE_D_IDS } from "./data/serie-d";

// Somente campeonatos masculinos de liga. Estaduais, competições históricas,
// femininas e ligas sem uma divisão parceira permanecem independentes.
const TIERS: string[][][] = [
  [["bra"], ["bra2"], ["bra3"], SERIE_D_IDS],
  [
    ["eng"],
    ["eng2"],
    ["x4396"],
    ["x4397"],
    ["x4590"],
    ["y4681", "y4682"],
    ["y4646", "y4647", "y4648", "y5324"],
    ["y5325", "y5326", "y5225", "y5226", "y5227", "y5228", "y5327", "y5328"],
  ],
  [
    ["esp"],
    ["esp2"],
    ["x5086", "y5088"],
    ["x5087", "y5089", "y5090", "y5091", "y5092"],
    [
      "y5538",
      "y5539",
      "y5540",
      "y5541",
      "y5542",
      "y5543",
      "y5544",
      "y5545",
      "y5546",
      "y5547",
      "y5548",
      "y5549",
      "y5550",
      "y5551",
      "y5552",
      "y5553",
      "y5554",
      "y5555",
    ],
  ],
  [
    ["ita"],
    ["ita2"],
    ["y5340", "y5339", "x4398"],
    ["y4786", "y4778", "y4779", "x4645", "y4780", "y4782", "y4783", "y4784", "y4785"],
  ],
  [
    ["ger"],
    ["ger2"],
    ["x4639"],
    ["x4695", "x4746", "y4747", "y4748", "y4749"],
    ["y5891", "y5892", "y5893", "y5894", "y5895", "y5896", "y5897", "y5898", "y5899"],
  ],
  [
    ["fra"],
    ["fra2"],
    ["x4637"],
    ["x5320", "y5321", "y5322"],
    ["y5777", "y5778", "y5779", "y5780", "y5781", "y5782", "y5783", "y5784"],
  ],
  [["por"], ["por2"], ["x5216"], ["x5745", "y5747"]],
  [["arg"], ["arg2", "y4616a"], ["x5215"]],
  [["sco"], ["sco2"], ["x4669"], ["x4670"]],
  [["tur"], ["tur2"], ["x5868", "x5869", "y5870"]],
  [["pol"], ["x4661"], ["x5709"], ["y5798", "y5799", "y5800", "y5801"]],
  [["jpn"], ["x4824"], ["x4967"]],
  [["sui"], ["x4713"], ["x5319"]],
  [["chi"], ["chi2"], ["x5481"]],
  [["hrv"], ["x4952"], ["x5910"]],
  [["cze"], ["x4954"], ["x5878"]],
  [["rou"], ["x4665"], ["x5821"]],
  [["rus"], ["x4666"], ["x5217"]],
  [["fin"], ["x5474"], ["x4963"]],
  [["isl"], ["x4906"], ["x5885"]],
  [["chn"], ["x4628"], ["x5310"]],
  [["ned"], ["ned2"]],
  [["bel"], ["x4623"]],
  [["gre"], ["x4640"]],
  [["aut"], ["x4796"]],
  [["den"], ["x4683"], ["x4632"]],
  [["nor"], ["x4457"]],
  [["swe"], ["x4403"]],
  [["ukr"], ["x4677"]],
  [["col"], ["col2"]],
  [["uru"], ["uru2"]],
  [["srb"], ["x5074"]],
  [["per"], ["x5073"]],
  [["ecu"], ["x4957"]],
  [["mar"], ["x4657"]],
  [["isr"], ["x4966"]],
  [["hun"], ["x4965"]],
  [["bul"], ["x4913"]],
  [["svk"], ["x5314"]],
  [["svn"], ["x5313"]],
  [["irl"], ["x4757"]],
  [["ven"], ["x5659"]],
  [["ind"], ["x4797"], ["x4821"]],
  [["mas"], ["x4789"]],
  [["vie"], ["x5214"]],
  [["irn"], ["x4741"]],
  [["kor"], ["y4822"]],
  [["bol"], ["y4910"]],
  [["est"], ["x4958"]],
];

/** Estaduais classificam para o nacional; são competições paralelas, não uma Série E. */
export const REGIONAL_LINKS: Record<
  string,
  {
    state: string;
    national: string;
    slots: number;
    cupSlots: number;
    source: string;
    adapted: boolean;
  }
> = {
  x5676: {
    state: "AC",
    national: "y5079b",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5678: {
    state: "AP",
    national: "y5079e",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5685: {
    state: "DF",
    national: "y5079c",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5684: {
    state: "BA",
    national: "y5079j",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5686: {
    state: "ES",
    national: "y5079l",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.capixaba,
    adapted: false,
  },
  x5762: {
    state: "MT",
    national: "y5079c",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5765: {
    state: "PB",
    national: "y5079i",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5764: {
    state: "PA",
    national: "y5079e",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5766: {
    state: "PR",
    national: "y5079o",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5769: {
    state: "PI",
    national: "y5079g",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5773: {
    state: "SE",
    national: "y5079i",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5772: {
    state: "RR",
    national: "y5079a",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5774: {
    state: "MS",
    national: "y5079k",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
  x5775: {
    state: "TO",
    national: "y5079e",
    slots: 1,
    cupSlots: 2,
    source: REGULATION_SOURCES.serieD,
    adapted: true,
  },
};
export function pyramidTiers(leagueId: string): string[][] | undefined {
  return TIERS.find((chain) => chain.some((tier) => tier.includes(leagueId)));
}

const known = new Set(LEAGUES.map((l) => l.id));
/** Relações simples mantidas para compatibilidade com a tabela e saves antigos. */
export const PYRAMID: Record<string, string> = {};
export const PYRAMID_UP: Record<string, string> = {};
for (const tiers of TIERS)
  for (let i = 0; i < tiers.length - 1; i++) {
    const top = tiers[i]?.filter((id) => known.has(id)) ?? [];
    const lower = tiers[i + 1]?.filter((id) => known.has(id)) ?? [];
    if (top.length === 1 && lower.length === 1) {
      PYRAMID[top[0]!] = lower[0]!;
      PYRAMID_UP[lower[0]!] = top[0]!;
    }
  }

export function slotsFor(topLeagueId: string, override?: number): number {
  if (override && override > 0) return Math.min(8, Math.floor(override));
  const rule = promotionRule(topLeagueId);
  return rule.direct + rule.playoff;
}

export function hasPyramid(leagueId: string): boolean {
  return TIERS.some((tiers) => tiers.some((tier) => tier.includes(leagueId)) && tiers.length > 1);
}

export function leagueClubIds(state: CareerState, leagueId?: string): string[] {
  const id = leagueId ?? state.leagueId;
  const saved = state.leagueClubs?.[id];
  return saved?.length ? [...saved] : getLeague(id).clubs.map((c) => c.id);
}

export type PyramidZone = "acesso" | "playoff" | "rebaixamento" | null;
export function pyramidZones(
  leagueId: string,
  size: number,
  override?: number,
  season = 1,
): PyramidZone[] {
  const tiers = TIERS.find((chain) => chain.some((tier) => tier.includes(leagueId)));
  if (!tiers) return Array(size).fill(null);
  const index = tiers.findIndex((tier) => tier.includes(leagueId));
  const year = calendarYear({ season });
  const zones: PyramidZone[] = Array(size).fill(null);
  const ruleFor = (id: string) =>
    override
      ? { ...promotionRule(id, year), direct: slotsFor(id, override), playoff: 0, candidates: 0 }
      : promotionRule(id, year);
  if (index > 0) {
    const groups = tiers[index]!.length;
    const base = ruleFor(tiers[index - 1]![0]!);
    const rule =
      groups > base.direct && !base.playoff
        ? { ...base, direct: 0, playoff: base.direct, candidates: groups }
        : base;
    const direct =
      Math.floor(rule.direct / groups) +
      (tiers[index]!.indexOf(leagueId) < rule.direct % groups ? 1 : 0);
    for (let i = 0; i < Math.min(size, direct); i++) zones[i] = "acesso";
    const candidates =
      groups > 1
        ? Math.floor(rule.candidates / groups) +
          (tiers[index]!.indexOf(leagueId) < rule.candidates % groups ? 1 : 0)
        : rule.candidates;
    for (let i = direct; i < Math.min(size, direct + (rule.playoff ? candidates : 0)); i++)
      zones[i] = "playoff";
  }
  if (index < tiers.length - 1) {
    const rule = ruleFor(tiers[index]![0]!);
    const total =
      leagueId === "bra3" && !override
        ? year < 2028
          ? 2
          : 6
        : rule.direct + (rule.againstUpper ? 0 : rule.playoff);
    const down = Math.min(size, Math.ceil(total / tiers[index]!.length));
    for (let i = size - down; i < size; i++) zones[i] = "rebaixamento";
    if (rule.againstUpper && size - down - 1 >= 0) zones[size - down - 1] = "playoff";
  }
  return zones;
}

export interface PyramidMove {
  leagueId: string;
  leagueClubs: Record<string, string[]>;
  moved: "subiu" | "desceu" | null;
  promoted: string[];
  relegated: string[];
  movements: { from: string; to: string; promoted: string[]; relegated: string[] }[];
  playoffs: CompetitionPlayoff[];
}

/** Calcula todas as transferências do país sobre uma fotografia da mesma temporada. */
export function applyPyramid(
  state: CareerState,
  table: TableRow[],
  override?: number,
  tables: Record<string, TableRow[]> = {},
): PyramidMove | null {
  const tiers = TIERS.find((chain) => chain.some((tier) => tier.includes(state.leagueId)));
  if (!tiers) return null;
  const ids = [...new Set(tiers.flat())].filter((id) => known.has(id));
  const snapshot = Object.fromEntries(ids.map((id) => [id, leagueClubIds(state, id)])) as Record<
    string,
    string[]
  >;
  const outgoing: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const incoming: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, []]));
  const movements: PyramidMove["movements"] = [];
  const playoffs: CompetitionPlayoff[] = [];
  const year = calendarYear(state);
  const managerRank = table.map((row) => row.clubId);
  const ordered = (id: string) =>
    id === state.leagueId &&
    managerRank.length === snapshot[id]?.length &&
    new Set(managerRank).size === managerRank.length &&
    managerRank.every((club) => snapshot[id]?.includes(club))
      ? managerRank
      : (
          tables[id] ??
          simulateDivisionTable(
            snapshot[id] ?? [],
            getLeague(id).country,
            `pyramid-${state.season}-${id}`,
          )
        ).map((r) => r.clubId);
  const rankings = Object.fromEntries(ids.map((id) => [id, ordered(id)]));
  const eligible = (id: string) => !/\b(U21|U23|II|B)\b/.test(CLUBS[id]?.name ?? "");
  const record = (from: string, to: string, promoted?: string, relegated?: string) => {
    if (promoted) {
      outgoing[from]!.push(promoted);
      incoming[to]!.push(promoted);
    }
    if (relegated) {
      outgoing[to]!.push(relegated);
      incoming[from]!.push(relegated);
    }
    let change = movements.find((m) => m.from === from && m.to === to);
    if (!change) {
      change = { from, to, promoted: [], relegated: [] };
      movements.push(change);
    }
    if (promoted) change.promoted.push(promoted);
    if (relegated) change.relegated.push(relegated);
  };

  for (let level = 0; level < tiers.length - 1; level++) {
    const upper = tiers[level]?.filter((id) => known.has(id)) ?? [];
    const lower = tiers[level + 1]?.filter((id) => known.has(id)) ?? [];
    if (!upper.length || !lower.length) continue;
    const base = promotionRule(upper[0]!, year);
    const rule = override
      ? { ...base, direct: slotsFor(upper[0]!, override), playoff: 0, candidates: 0 }
      : lower.length > base.direct && !base.playoff
        ? { ...base, direct: 0, playoff: base.direct, candidates: lower.length }
        : base;
    const candidatePool = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => {
        const group = lower[i % lower.length]!;
        const ranked = rankings[group]!.filter(eligible);
        return ranked[start + Math.floor(i / lower.length)];
      }).filter((id): id is string => Boolean(id));
    const promoted = candidatePool(0, rule.direct);
    let contenders = candidatePool(Math.ceil(rule.direct / lower.length), rule.candidates);
    const decide = (a: string, b: string, index: number) => {
      const result = competitionPlayoff(
        a,
        b,
        `access-${state.season}-${upper[0]}-${index}-${a}-${b}`,
      );
      // Série B: igualdade no agregado favorece a melhor campanha.
      if (upper[0] === "bra" && result.penalties) {
        result.winner = a;
        result.penalties = false;
      }
      playoffs.push(result);
      return result.winner;
    };
    if (!override && upper[0] === "bra2") {
      // Série C: oito classificados, dois quadrangulares, os dois primeiros sobem.
      const groups = [
        [0, 3, 4, 7],
        [1, 2, 5, 6],
      ];
      for (const group of groups)
        promoted.push(
          ...simulateDivisionTable(
            group.map((i) => contenders[i]).filter((id): id is string => Boolean(id)),
            "Brasil",
            `serie-c-${state.season}-${group[0]}`,
          )
            .slice(0, 2)
            .map((r) => r.clubId),
        );
    } else if (!override && upper[0] === "bra3") {
      // 2026: four qualifiers per group, crossed against the adjacent group.
      if (lower.length === 16 && contenders.length === 64) {
        const crossed: string[] = [];
        for (let group = 0; group < lower.length; group += 2)
          for (let rank = 0; rank < 4; rank++)
            crossed.push(
              decide(
                rankings[lower[group]!]![rank]!,
                rankings[lower[group + 1]!]![3 - rank]!,
                playoffs.length,
              ),
            );
        contenders = crossed;
      }
      // Four semifinalists and two winners in the quarter-final losers' repechage.
      while (contenders.length > 8) {
        const next: string[] = [];
        for (let i = 0; i < Math.floor(contenders.length / 2); i++)
          next.push(
            decide(contenders[i]!, contenders[contenders.length - 1 - i]!, playoffs.length),
          );
        if (contenders.length % 2) next.push(contenders[Math.floor(contenders.length / 2)]!);
        contenders = next;
      }
      const losers: string[] = [];
      for (let i = 0; i < Math.floor(contenders.length / 2); i++) {
        const a = contenders[i]!,
          b = contenders[contenders.length - 1 - i]!,
          winner = decide(a, b, playoffs.length);
        promoted.push(winner);
        losers.push(winner === a ? b : a);
      }
      for (let i = 0; i + 1 < losers.length; i += 2)
        promoted.push(decide(losers[i]!, losers[i + 1]!, playoffs.length));
    } else if (rule.playoff) {
      while (contenders.length > rule.playoff) {
        // Os melhores têm folga quando o número de candidatos não é potência de dois (EFL: 3º/4º).
        let count = 1;
        while (count * 2 < contenders.length) count *= 2;
        const byeCount = 2 * count - contenders.length;
        const next = contenders.slice(0, byeCount);
        const playing = contenders.slice(byeCount);
        for (let i = 0; i < playing.length / 2; i++)
          next.push(decide(playing[i]!, playing[playing.length - 1 - i]!, playoffs.length));
        contenders = next;
      }
      if (rule.againstUpper) {
        for (let i = 0; i < contenders.length; i++) {
          const upperId = upper[i % upper.length]!,
            defender = rankings[upperId]!.at(-1 - rule.direct - i);
          if (defender && decide(contenders[i]!, defender, playoffs.length) === contenders[i])
            record(
              lower.find((id) => snapshot[id]!.includes(contenders[i]!))!,
              upperId,
              contenders[i],
              defender,
            );
        }
      } else promoted.push(...contenders);
    }
    const downCount = !override && upper[0] === "bra3" ? (year < 2028 ? 2 : 6) : promoted.length;
    for (let i = 0; i < Math.max(promoted.length, downCount); i++) {
      const promotion = promoted[i],
        from = promotion
          ? lower.find((id) => snapshot[id]!.includes(promotion))!
          : lower[i % lower.length]!;
      const to = upper[i % upper.length]!,
        relegation =
          i < downCount ? rankings[to]!.at(-1 - Math.floor(i / upper.length)) : undefined;
      if (promotion || relegation) record(from, to, promotion, relegation);
    }
  }
  if (!movements.length) return null;
  const leagueClubs = Object.fromEntries(
    ids.map((id) => [
      id,
      [...snapshot[id]!.filter((club) => !outgoing[id]?.includes(club)), ...(incoming[id] ?? [])],
    ]),
  ) as Record<string, string[]>;
  const myPromotion = movements.find((m) => m.promoted.includes(state.clubId));
  const myRelegation = movements.find((m) => m.relegated.includes(state.clubId));
  const moved = myPromotion ? "subiu" : myRelegation ? "desceu" : null;
  return {
    leagueId: myPromotion?.to ?? myRelegation?.from ?? state.leagueId,
    leagueClubs,
    moved,
    promoted: movements.flatMap((m) => m.promoted),
    relegated: movements.flatMap((m) => m.relegated),
    movements,
    playoffs,
  };
}
