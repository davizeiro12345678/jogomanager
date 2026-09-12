import { CLUBS, getLeague } from "./data/leagues";
import type { CareerState } from "./types";

export type AchievementTier = "bronze" | "prata" | "ouro";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: AchievementTier;
}

const CONTINENTAL_NAMES = new Set([
  "Copa Libertadores",
  "Champions League",
  "CAF Champions League",
  "CONCACAF Champions Cup",
  "AFC Champions League",
]);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "primeira-vitoria", title: "Primeira vitória", description: "Vença sua primeira partida no comando.", icon: "⚽", tier: "bronze" },
  { id: "dez-vitorias", title: "Dez vitórias", description: "Conquiste 10 vitórias na carreira.", icon: "🥉", tier: "bronze" },
  { id: "cinquenta-vitorias", title: "Meio century", description: "Conquiste 50 vitórias na carreira.", icon: "🥈", tier: "prata" },
  { id: "cem-vitorias", title: "Century de vitórias", description: "Conquiste 100 vitórias na carreira.", icon: "🥇", tier: "ouro" },
  { id: "campeao-liga", title: "Campeão da liga", description: "Termine uma temporada em 1º lugar.", icon: "🏆", tier: "ouro" },
  { id: "bicampeao", title: "Bicampeão", description: "Vença a liga em duas temporadas.", icon: "🏆", tier: "ouro" },
  { id: "vice-campeao", title: "Vice-campeão", description: "Termine uma temporada em 2º lugar.", icon: "🥈", tier: "prata" },
  { id: "campeao-copa", title: "Campeão da copa", description: "Levante a taça da copa nacional.", icon: "🏆", tier: "prata" },
  { id: "campeao-continental", title: "Campeão continental", description: "Vença uma competição continental.", icon: "🌍", tier: "ouro" },
  { id: "acesso-elite", title: "Acesso à elite", description: "Assine com um clube bem maior que o anterior.", icon: "📈", tier: "prata" },
  { id: "invencibilidade-10", title: "Invencibilidade", description: "Fique 10 jogos seguidos sem perder.", icon: "🛡️", tier: "prata" },
  { id: "goleada", title: "Goleada", description: "Vença uma partida por 5 gols de diferença ou mais.", icon: "💥", tier: "bronze" },
  { id: "artilharia-time-100", title: "Ataque implacável", description: "Marque 100 gols com o time em uma temporada.", icon: "🎯", tier: "ouro" },
  { id: "artilheiro-30", title: "Artilheiro", description: "Tenha um jogador com 30+ gols na temporada.", icon: "👟", tier: "prata" },
  { id: "contratacao-50m", title: "Grande contratação", description: "Contrate um jogador por mais de €50M.", icon: "💰", tier: "ouro" },
  { id: "joia-da-base", title: "Joia da base", description: "Revele um garoto da base com 85+ de potencial.", icon: "💎", tier: "prata" },
  { id: "sobreviver-crise", title: "Sangue frio", description: "Sobreviva a uma crise com pressão acima de 90.", icon: "🧊", tier: "prata" },
  { id: "cinco-temporadas", title: "Fidelidade", description: "Complete 5 temporadas no mesmo clube.", icon: "🏛️", tier: "ouro" },
  { id: "caixa-positivo", title: "Gestão sólida", description: "Acumule um caixa de €100M ou mais.", icon: "🏦", tier: "prata" },
  { id: "primeira-temporada", title: "Primeiro ano completo", description: "Complete sua primeira temporada.", icon: "📅", tier: "bronze" },
  { id: "dez-titulos", title: "Colecionador de taças", description: "Conquiste 10 troféus na carreira.", icon: "👑", tier: "ouro" },
  { id: "resiliencia", title: "Resiliência", description: "Volte ao mercado e assuma um novo clube após sair de outro.", icon: "🔁", tier: "bronze" },
  { id: "cem-jogos", title: "Veterano de banco", description: "Comande 100 partidas na carreira.", icon: "📋", tier: "prata" },
  { id: "patrimonio-bilionario", title: "Impacto financeiro", description: "Acumule um caixa de €250M ou mais.", icon: "💎", tier: "ouro" },
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export function achievementById(id: string): Achievement | undefined {
  return byId.get(id);
}

function careerWins(state: CareerState): number {
  const log = state.matchLog ?? [];
  return log.filter((m) => m.gf > m.ga).length;
}

function bestWinMargin(state: CareerState): number {
  const log = state.matchLog ?? [];
  return log.reduce((max, m) => Math.max(max, m.gf - m.ga), 0);
}

function bestSeasonGoals(state: CareerState): number {
  const log = state.matchLog ?? [];
  const bySeason = new Map<number, number>();
  for (const m of log) bySeason.set(m.season, (bySeason.get(m.season) ?? 0) + m.gf);
  return Math.max(0, ...bySeason.values());
}

function bestPlayerSeasonGoals(state: CareerState): number {
  const log = state.matchLog ?? [];
  const bySeasonPlayer = new Map<string, number>();
  for (const m of log) {
    for (const p of m.players) {
      const key = `${m.season}-${p.pid}`;
      bySeasonPlayer.set(key, (bySeasonPlayer.get(key) ?? 0) + p.goals);
    }
  }
  return Math.max(0, ...bySeasonPlayer.values());
}

function longestUnbeatenStreak(state: CareerState): number {
  const log = [...(state.matchLog ?? [])].reverse();
  let best = 0;
  let cur = 0;
  for (const m of log) {
    if (m.gf >= m.ga) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

function sameClubSeasons(state: CareerState): number {
  const history = state.managerHistory ?? [];
  const last = history[history.length - 1];
  if (!last) return state.season;
  const from = last.from;
  return Math.max(1, state.season - from + 1);
}

function promotedGems(state: CareerState): boolean {
  return Object.values(state.players).some((p) => (p.potential ?? 0) >= 85 && p.apps === 0 && p.age <= 19);
}

/** Avalia o estado da carreira e retorna os ids de conquistas recém-desbloqueadas. */
export function evaluateAchievements(state: CareerState): string[] {
  const already = new Set(state.achievements ?? []);
  const unlocked: string[] = [];
  const unlock = (id: string) => {
    if (!already.has(id) && byId.has(id)) unlocked.push(id);
  };

  const wins = careerWins(state);
  if (wins >= 1) unlock("primeira-vitoria");
  if (wins >= 10) unlock("dez-vitorias");
  if (wins >= 50) unlock("cinquenta-vitorias");
  if (wins >= 100) unlock("cem-vitorias");

  const league = getLeague(state.leagueId);
  const leagueTitles = state.history.filter((h) => h.position === 1).length;
  if (leagueTitles >= 1) unlock("campeao-liga");
  if (leagueTitles >= 2) unlock("bicampeao");
  if (state.history.some((h) => h.position === 2)) unlock("vice-campeao");

  const cupTrophies = state.trophies.filter((t) => t.name !== league.name);
  if (cupTrophies.some((t) => !CONTINENTAL_NAMES.has(t.name))) unlock("campeao-copa");
  if (cupTrophies.some((t) => CONTINENTAL_NAMES.has(t.name))) unlock("campeao-continental");

  if (bestWinMargin(state) >= 5) unlock("goleada");
  if (bestSeasonGoals(state) >= 100) unlock("artilharia-time-100");
  if (bestPlayerSeasonGoals(state) >= 30) unlock("artilheiro-30");
  if (longestUnbeatenStreak(state) >= 10) unlock("invencibilidade-10");
  if (promotedGems(state)) unlock("joia-da-base");
  if ((state.pressure ?? 0) >= 90 && !state.sacked) unlock("sobreviver-crise");
  if (sameClubSeasons(state) >= 5) unlock("cinco-temporadas");
  if ((state.finances?.budget ?? 0) >= 100) unlock("caixa-positivo");
  if ((state.finances?.budget ?? 0) >= 250) unlock("patrimonio-bilionario");
  if (state.season >= 2) unlock("primeira-temporada");
  if (state.trophies.length >= 10) unlock("dez-titulos");
  if ((state.matchLog ?? []).length >= 100) unlock("cem-jogos");

  // maior contratação da carreira (registro permanente, não zera na temporada)
  if ((state.records?.biggestSigning ?? 0) >= 50) unlock("contratacao-50m");

  const history = state.managerHistory ?? [];
  if (history.length >= 2) unlock("resiliencia");
  if ((state.records?.promotions ?? 0) >= 1) unlock("acesso-elite");
  for (let i = 1; i < history.length; i++) {
    const prev = CLUBS[history[i - 1]!.clubId]?.strength ?? 0;
    const cur = CLUBS[history[i]!.clubId]?.strength ?? 0;
    if (cur - prev >= 8) unlock("acesso-elite");
  }

  return unlocked;
}

export interface Milestone {
  id: string;
  label: string;
  value: number;
  target: number;
  suffix?: string;
}

/** Marcos de progresso: mostram o quanto falta para o próximo degrau. */
export function careerMilestones(state: CareerState): Milestone[] {
  const log = state.matchLog ?? [];
  const wins = careerWins(state);
  const step = (v: number, steps: number[]) => steps.find((s) => v < s) ?? steps[steps.length - 1]!;

  const goals = log.reduce((sum, m) => sum + m.gf, 0);
  const titles = state.trophies.length;
  const budget = Math.max(0, Math.round(state.finances?.budget ?? 0));

  return [
    { id: "jogos", label: "Partidas comandadas", value: log.length, target: step(log.length, [10, 50, 100, 250, 500]) },
    { id: "vitorias", label: "Vitórias", value: wins, target: step(wins, [1, 10, 50, 100, 250]) },
    { id: "gols", label: "Gols marcados", value: goals, target: step(goals, [50, 150, 400, 1000]) },
    { id: "titulos", label: "Troféus", value: titles, target: step(titles, [1, 3, 5, 10, 20]) },
    { id: "temporadas", label: "Temporadas completas", value: state.history.length, target: step(state.history.length, [1, 3, 5, 10]) },
    { id: "acessos", label: "Acessos conquistados", value: state.records?.promotions ?? 0, target: step(state.records?.promotions ?? 0, [1, 2, 3]) },
    { id: "caixa", label: "Caixa do clube", value: budget, target: step(budget, [25, 100, 250, 500]), suffix: "M€" },
    {
      id: "contratacao",
      label: "Maior contratação",
      value: Math.round(state.records?.biggestSigning ?? 0),
      target: step(state.records?.biggestSigning ?? 0, [10, 25, 50, 100]),
      suffix: "M€",
    },
  ];
}
