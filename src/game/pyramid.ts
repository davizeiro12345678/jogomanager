/** Movimentação entre divisões da mesma pirâmide, sem alterar o catálogo global. */
import { CLUBS, LEAGUES, getLeague } from "./data/leagues";
import type { CareerState, TableRow } from "./types";

// Somente campeonatos masculinos de liga. Estaduais, competições históricas,
// femininas e ligas sem uma divisão parceira permanecem independentes.
const TIERS: string[][][] = [
  [["bra"], ["bra2"], ["bra3"], ["y5079a", "y5079b", "y5079c"]],
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
    ["x4637", "x5320", "y5321", "y5322"],
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
  [["mex"], ["x4654"]],
  [["gre"], ["x4640"]],
  [["aut"], ["x4796"]],
  [["den"], ["x4632"]],
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

const DEFAULT_SLOTS: Record<string, number> = {
  bra: 4,
  bra2: 4,
  bra3: 4,
  eng: 3,
  eng2: 3,
  x4396: 4,
  x4397: 2,
  esp: 3,
  esp2: 4,
  ita: 3,
  ita2: 4,
  ger: 2,
  ger2: 3,
  fra: 3,
  fra2: 3,
  por: 2,
  por2: 2,
  ned: 2,
  arg: 2,
};
export function slotsFor(topLeagueId: string, override?: number): number {
  if (override && override > 0) return Math.min(8, Math.floor(override));
  return DEFAULT_SLOTS[topLeagueId] ?? 2;
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
  const quota = (level: number, side: "upper" | "lower") => {
    const upper = tiers[level] ?? [];
    const lower = tiers[level + 1] ?? [];
    if (!upper.length || !lower.length) return 0;
    const capacity = Math.min(8, ...upper.map((id) => Math.floor(getLeague(id).clubs.length / 3)));
    const vacancies = Math.min(slotsFor(upper[0]!, override), capacity);
    const rotated = [
      ...lower.slice(season % lower.length),
      ...lower.slice(0, season % lower.length),
    ];
    return Array.from({ length: vacancies }, (_, i) =>
      side === "upper" ? upper[i % upper.length] : rotated[i % rotated.length],
    ).filter((id) => id === leagueId).length;
  };
  const up = index > 0 ? Math.min(size, quota(index - 1, "lower")) : 0;
  const down = index < tiers.length - 1 ? Math.min(size - up, quota(index, "upper")) : 0;
  return Array.from({ length: size }, (_, i) =>
    i < up ? "acesso" : i >= size - down ? "rebaixamento" : null,
  );
}

export interface PyramidMove {
  leagueId: string;
  leagueClubs: Record<string, string[]>;
  moved: "subiu" | "desceu" | null;
  promoted: string[];
  relegated: string[];
  movements: { from: string; to: string; promoted: string[]; relegated: string[] }[];
}

const strengthOf = (id: string) => CLUBS[id]?.strength ?? 70;
const rank = (ids: string[]) =>
  [...ids].sort((a, b) => strengthOf(b) - strengthOf(a) || a.localeCompare(b));

/** Calcula todas as transferências do país sobre uma fotografia da mesma temporada. */
export function applyPyramid(
  state: CareerState,
  table: TableRow[],
  override?: number,
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
  const managerRank = table.map((row) => row.clubId);
  const ordered = (id: string) =>
    id === state.leagueId &&
    managerRank.length === snapshot[id]?.length &&
    new Set(managerRank).size === managerRank.length &&
    managerRank.every((club) => snapshot[id]?.includes(club))
      ? managerRank
      : rank(snapshot[id] ?? []);

  for (let level = 0; level < tiers.length - 1; level++) {
    const upper = tiers[level]?.filter((id) => known.has(id)) ?? [];
    const lower = tiers[level + 1]?.filter((id) => known.has(id)) ?? [];
    if (!upper.length || !lower.length) continue;
    const capacity = Math.min(8, ...upper.map((id) => Math.floor((snapshot[id]?.length ?? 0) / 3)));
    const vacancies = Math.min(slotsFor(upper[0]!, override), capacity);
    if (vacancies <= 0) continue;
    // Percorre os grupos em rotação por temporada; um campeão não concorre
    // com todos os outros quando há mais grupos que vagas disponíveis.
    const groupOrder = [
      ...lower.slice(state.season % lower.length),
      ...lower.slice(0, state.season % lower.length),
    ];
    const assignments = Array.from({ length: vacancies }, (_, i) => ({
      from: groupOrder[i % groupOrder.length]!,
      to: upper[i % upper.length]!,
    }));
    const usedUp: Record<string, number> = {};
    const usedDown: Record<string, number> = {};
    for (const { from, to } of assignments) {
      const promoted = ordered(from)[usedUp[from] ?? 0];
      const relegated = ordered(to).at(-1 - (usedDown[to] ?? 0));
      if (!promoted || !relegated || promoted === relegated) continue;
      usedUp[from] = (usedUp[from] ?? 0) + 1;
      usedDown[to] = (usedDown[to] ?? 0) + 1;
      outgoing[from]?.push(promoted);
      incoming[to]?.push(promoted);
      outgoing[to]?.push(relegated);
      incoming[from]?.push(relegated);
      const record = movements.find((m) => m.from === from && m.to === to);
      if (record) {
        record.promoted.push(promoted);
        record.relegated.push(relegated);
      } else movements.push({ from, to, promoted: [promoted], relegated: [relegated] });
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
  };
}
