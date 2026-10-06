import { CLUBS, getLeague, LEAGUES } from "@/game/data/leagues";
import type { Club } from "@/game/types";
import { ATTRIBUTES, ageGrowth, attrLabel, keyAttributes, overallFor } from "./attributes";
import type {
  AttributeGroup,
  CreateAthleteInput,
  KeyMoment,
  MatchReport,
  MatchRole,
  NewsItem,
  Offer,
  PlayerCareerState,
  PlayerPosition,
  SeasonLine,
  TrainingIntensity,
} from "./types";

// ---------- RNG determinística por semente ----------
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rngFrom(text: string) {
  let a = hashSeed(text);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export const RETIREMENT_FORCED_AGE = 40;
export const TRAINING_GAIN: Record<TrainingIntensity, number> = { leve: 0.12, normal: 0.22, pesado: 0.36 };
export const TRAINING_ENERGY: Record<TrainingIntensity, number> = { leve: 6, normal: 14, pesado: 24 };
export const TRAINING_INJURY: Record<TrainingIntensity, number> = { leve: 0.004, normal: 0.012, pesado: 0.035 };

export function overall(state: PlayerCareerState): number {
  return overallFor(state.attrs, state.position);
}

export function seasonLength(state: PlayerCareerState): number {
  const n = getLeague(state.leagueId).clubs.length;
  return Math.max(10, (Math.max(n, 6) - 1) * 2);
}

export function clubOf(state: PlayerCareerState): Club | undefined {
  return CLUBS[state.clubId];
}

function emptyLine(season: number, age: number, clubId: string): SeasonLine {
  return { season, age, clubId, apps: 0, starts: 0, goals: 0, assists: 0, ratingSum: 0, motm: 0 };
}

function news(state: PlayerCareerState, title: string, tone: NewsItem["tone"]): NewsItem {
  return { id: `${state.season}-${state.week}-${state.news.length}-${hashSeed(title)}`, season: state.season, week: state.week, title, tone };
}

function pushNews(state: PlayerCareerState, title: string, tone: NewsItem["tone"]) {
  state.news = [news(state, title, tone), ...state.news].slice(0, 40);
}

// ---------- criação ----------
export function createAthlete(input: CreateAthleteInput, now = Date.now()): PlayerCareerState {
  const club = CLUBS[input.clubId];
  if (!club) throw new Error("Clube inválido");
  const seed = `${input.name}|${input.clubId}|${now}`;
  const rnd = rngFrom(seed);
  const originBase = input.origin === "base" ? 50 : input.origin === "peneira" ? 47 : 42;
  const potentialBonus = input.origin === "varzea" ? 6 : input.origin === "peneira" ? 3 : 0;
  const potential = clamp(Math.round(74 + rnd() * 18 + potentialBonus), 70, 97);
  const key = new Set(keyAttributes(input.position).slice(0, 5));
  const attrs: Record<string, number> = {};
  for (const def of ATTRIBUTES) {
    let base = originBase + rnd() * 10 - 5;
    if (key.has(def.key)) base += 8;
    if (def.group === "goleiro" && input.position !== "GOL") base = 18 + rnd() * 10;
    if (input.position === "GOL" && (def.group === "tecnico" || def.group === "defensivo")) base -= 10;
    if (def.group === "fisico") {
      if (input.build === "leve" && (def.key === "velocidade" || def.key === "agilidade")) base += 5;
      if (input.build === "forte" && (def.key === "forca" || def.key === "impulsao")) base += 6;
      if (input.build === "forte" && def.key === "velocidade") base -= 3;
    }
    if (input.heightCm >= 188 && (def.key === "cabeceio" || def.key === "jogo_aereo")) base += 4;
    attrs[def.key] = Math.round(clamp(base, 15, 70));
  }
  const ovr = overallFor(attrs, input.position);
  const weightKg = Math.round((input.heightCm - 100) * (input.build === "forte" ? 0.98 : input.build === "leve" ? 0.82 : 0.9));
  const state: PlayerCareerState = {
    version: 1,
    slot: input.slot,
    seed,
    name: input.name.trim().slice(0, 40),
    nickname: input.nickname.trim().slice(0, 16) || input.name.split(" ")[0]!.slice(0, 16),
    nation: input.nation,
    hometown: input.hometown.trim().slice(0, 40),
    position: input.position,
    secondary: [],
    foot: input.foot,
    weakFoot: 2 + Math.floor(rnd() * 2),
    heightCm: input.heightCm,
    weightKg,
    build: input.build,
    personality: input.personality,
    origin: input.origin,
    appearance: input.appearance,
    shirtNumber: input.shirtNumber,
    age: 17,
    season: 1,
    week: 1,
    leagueId: club.league,
    clubId: club.id,
    attrs,
    potential,
    potentialSeenRange: [clamp(potential - 12, 60, 99), clamp(potential + 8, 60, 99)],
    traits: [],
    energy: 100,
    form: 60,
    morale: 70,
    trust: input.origin === "base" ? 40 : 30,
    chemistry: input.origin === "base" ? 55 : 35,
    injury: null,
    contract: { clubId: club.id, salary: 800 + ovr * 20, untilSeason: 3, goalBonus: 200, releaseClause: 500_000 + ovr * 20_000 },
    money: 0,
    followers: input.origin === "varzea" ? 300 : 1200,
    reputation: 5,
    nationalCaps: 0,
    nationalGoals: 0,
    awards: [],
    current: emptyLine(1, 17, club.id),
    history: [],
    lastMatch: null,
    recent: [],
    news: [],
    offers: [],
    pendingMoment: null,
    retired: false,
    createdAt: now,
    updatedAt: now,
  };
  pushNews(state, `${state.nickname} assina o primeiro contrato profissional com o ${club.name}.`, "good");
  return state;
}

// ---------- escalação ----------
export function selectionFor(state: PlayerCareerState, rnd: () => number): MatchRole {
  if (state.injury) return "fora";
  const club = clubOf(state);
  const squadLevel = club?.strength ?? 70;
  const score = overall(state) - squadLevel + (state.form - 50) * 0.15 + (state.trust - 50) * 0.25 + (state.energy - 70) * 0.1 + rnd() * 8;
  if (score > -2) return "titular";
  if (score > -22) return "reserva";
  return "fora";
}

// ---------- lances-chave ----------
const MOMENTS: Record<"ataque" | "meio" | "defesa" | "gol", Omit<KeyMoment, "id" | "minute">[]> = {
  ataque: [
    { prompt: "Você recebe na entrada da área, de costas para o zagueiro.", options: [
      { id: "giro", label: "Girar e finalizar", attr: "finalizacao", risk: 0.55, reward: "goal" },
      { id: "toque", label: "Tocar para o companheiro livre", attr: "passe_curto", risk: 0.3, reward: "assist" },
      { id: "segurar", label: "Segurar e esperar apoio", attr: "dominio", risk: 0.15, reward: "keep" },
    ] },
    { prompt: "Contra-ataque: só o goleiro pela frente.", options: [
      { id: "cavadinha", label: "Cavadinha", attr: "compostura", risk: 0.6, reward: "goal" },
      { id: "canto", label: "Bater no canto", attr: "finalizacao", risk: 0.45, reward: "goal" },
      { id: "driblar", label: "Driblar o goleiro", attr: "drible", risk: 0.55, reward: "goal" },
    ] },
  ],
  meio: [
    { prompt: "Bola no meio, marcador colado e um lançamento possível.", options: [
      { id: "lancar", label: "Lançar em profundidade", attr: "passe_longo", risk: 0.5, reward: "assist" },
      { id: "driblar", label: "Driblar o marcador", attr: "drible", risk: 0.45, reward: "keep" },
      { id: "simples", label: "Passe simples de lado", attr: "passe_curto", risk: 0.1, reward: "keep" },
    ] },
    { prompt: "Falta perigosa na intermediária.", options: [
      { id: "direto", label: "Bater direto", attr: "bola_parada", risk: 0.65, reward: "goal" },
      { id: "cruzar", label: "Cruzar na área", attr: "cruzamento", risk: 0.4, reward: "assist" },
    ] },
  ],
  defesa: [
    { prompt: "Atacante rival parte em velocidade na sua direção.", options: [
      { id: "carrinho", label: "Dar o carrinho", attr: "carrinho", risk: 0.5, reward: "tackle" },
      { id: "conter", label: "Conter e acompanhar", attr: "marcacao", risk: 0.25, reward: "tackle" },
      { id: "antecipar", label: "Antecipar o passe", attr: "interceptacao", risk: 0.4, reward: "tackle" },
    ] },
    { prompt: "Escanteio contra, bola vindo na sua área.", options: [
      { id: "cabeca", label: "Subir de cabeça", attr: "cabeceio", risk: 0.3, reward: "tackle" },
      { id: "marcar", label: "Marcar o homem", attr: "posicionamento", risk: 0.25, reward: "tackle" },
    ] },
  ],
  gol: [
    { prompt: "Chute forte no ângulo.", options: [
      { id: "voar", label: "Voar na bola", attr: "elasticidade", risk: 0.45, reward: "save" },
      { id: "espalmar", label: "Espalmar por cima", attr: "reflexo", risk: 0.35, reward: "save" },
    ] },
    { prompt: "Atacante sozinho na cara do gol.", options: [
      { id: "sair", label: "Sair abafando", attr: "saida_gol", risk: 0.4, reward: "save" },
      { id: "esperar", label: "Esperar na linha", attr: "reflexo", risk: 0.5, reward: "save" },
    ] },
  ],
};

function zoneFor(position: PlayerPosition): (keyof typeof MOMENTS)[] {
  if (position === "GOL") return ["gol", "gol", "defesa"];
  if (position === "ZAG") return ["defesa", "defesa", "meio"];
  if (position === "LAT" || position === "VOL") return ["defesa", "meio", "ataque"];
  if (position === "MEI") return ["meio", "meio", "ataque"];
  return ["ataque", "ataque", "meio"];
}

export function buildMoments(state: PlayerCareerState): KeyMoment[] {
  const rnd = rngFrom(`${state.seed}|m|${state.season}|${state.week}`);
  const zones = zoneFor(state.position);
  const count = 3 + Math.floor(rnd() * 2);
  const out: KeyMoment[] = [];
  for (let i = 0; i < count; i++) {
    const pool = MOMENTS[zones[i % zones.length]!];
    const base = pool[Math.floor(rnd() * pool.length)]!;
    out.push({ ...base, id: `m${i}`, minute: Math.round(8 + (i + rnd()) * (80 / count)) });
  }
  return out.sort((a, b) => a.minute - b.minute);
}

// ---------- adversário da semana ----------
export function opponentFor(state: PlayerCareerState): { club: Club; home: boolean } {
  const league = getLeague(state.leagueId);
  const others = league.clubs.filter((c) => c.id !== state.clubId);
  const pool = others.length ? others : Object.values(CLUBS).slice(0, 10).filter((c) => c.id !== state.clubId);
  const idx = (state.week - 1) % pool.length;
  return { club: pool[idx]!, home: state.week % 2 === 1 };
}

// ---------- semana ----------
export interface WeekPlan {
  focus: AttributeGroup[];
  intensity: TrainingIntensity;
  choices?: Record<string, string>; // momentId -> optionId
}

function applyTraining(state: PlayerCareerState, plan: WeekPlan, rnd: () => number) {
  const gain = TRAINING_GAIN[plan.intensity];
  const growthRoom = clamp((state.potential - overall(state)) / 20, 0.15, 1.4);
  const ageFactor = state.age <= 21 ? 1.3 : state.age <= 26 ? 1 : state.age <= 30 ? 0.55 : 0.25;
  const personality = state.personality === "profissional" ? 1.15 : state.personality === "temperamental" ? 0.9 : 1;
  for (const def of ATTRIBUTES) {
    if (!plan.focus.includes(def.group)) continue;
    if (def.group === "goleiro" && state.position !== "GOL") continue;
    const delta = gain * growthRoom * ageFactor * personality * (0.6 + rnd() * 0.8);
    state.attrs[def.key] = round1(clamp((state.attrs[def.key] ?? 40) + delta, 1, 99));
  }
  state.energy = clamp(state.energy - TRAINING_ENERGY[plan.intensity] + 18, 10, 100);
  if (!state.injury && rnd() < TRAINING_INJURY[plan.intensity] * (state.energy < 40 ? 2 : 1) * (state.traits.includes("vidro") ? 1.6 : 1)) {
    const kinds = [
      { label: "Estiramento na coxa", weeks: 2 },
      { label: "Entorse no tornozelo", weeks: 3 },
      { label: "Lesão muscular na panturrilha", weeks: 4 },
      { label: "Lesão no joelho", weeks: 8 },
    ];
    const k = kinds[Math.floor(rnd() * (plan.intensity === "pesado" ? 4 : 3))]!;
    state.injury = { label: k.label, weeksLeft: k.weeks };
    pushNews(state, `${state.nickname} se lesiona no treino: ${k.label.toLowerCase()} (${k.weeks} semanas).`, "bad");
  }
}

function resolveMoments(state: PlayerCareerState, moments: KeyMoment[], choices: Record<string, string>, rnd: () => number) {
  let goals = 0;
  let assists = 0;
  let good = 0;
  let bad = 0;
  const reasons: string[] = [];
  for (const m of moments) {
    const opt = m.options.find((o) => o.id === choices[m.id]) ?? m.options[m.options.length - 1]!;
    const skill = (state.attrs[opt.attr] ?? 40) / 100;
    const chance = clamp(skill * (1 - opt.risk) + 0.18 + (state.form - 50) / 400, 0.05, 0.92);
    const success = rnd() < chance;
    if (success) {
      good += 1 + opt.risk;
      if (opt.reward === "goal") { goals++; reasons.push(`${m.minute}': gol (${opt.label.toLowerCase()})`); }
      else if (opt.reward === "assist") { if (rnd() < 0.55) { assists++; reasons.push(`${m.minute}': assistência`); } else reasons.push(`${m.minute}': passe decisivo`); }
      else if (opt.reward === "save") reasons.push(`${m.minute}': defesa importante`);
      else if (opt.reward === "tackle") reasons.push(`${m.minute}': desarme decisivo`);
    } else {
      bad += opt.risk;
      reasons.push(`${m.minute}': ${opt.label.toLowerCase()} não deu certo (${attrLabel(opt.attr)})`);
    }
  }
  return { goals, assists, good, bad, reasons };
}

function playMatch(state: PlayerCareerState, role: MatchRole, plan: WeekPlan, rnd: () => number): MatchReport {
  const { club: opp, home } = opponentFor(state);
  const mine = clubOf(state)?.strength ?? 70;
  const minutes = role === "titular" ? (rnd() < 0.8 ? 90 : 60 + Math.round(rnd() * 25)) : role === "reserva" ? (rnd() < 0.6 ? Math.round(10 + rnd() * 30) : 0) : 0;
  const played = minutes > 0;
  let myGoals = 0;
  let myAssists = 0;
  let impact = 0;
  const reasons: string[] = [];
  if (played) {
    const moments = state.pendingMoment?.week === state.week ? state.pendingMoment.moments : buildMoments(state);
    const usable = role === "titular" ? moments : moments.slice(-1);
    const choices = plan.choices ?? {};
    const r = resolveMoments(state, usable, choices, rnd);
    myGoals = r.goals; myAssists = r.assists; impact = r.good - r.bad;
    reasons.push(...r.reasons);
  }
  const homeAdv = home ? 3 : -3;
  const diff = (mine - opp.strength + homeAdv + impact * 2) / 12;
  const lambdaFor = 1.3 + diff * 0.6;
  const lambdaAg = 1.2 - diff * 0.5;
  const poisson = (l: number) => { const L = Math.exp(-clamp(l, 0.2, 4)); let k = 0; let p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
  let gf = Math.max(myGoals + myAssists, poisson(lambdaFor));
  const ga = poisson(lambdaAg);
  gf = Math.max(gf, myGoals);
  let rating: number | null = null;
  if (played) {
    const result = gf > ga ? 0.4 : gf === ga ? 0 : -0.4;
    const base = 6.1 + (overall(state) - mine) / 30 + (state.form - 50) / 100;
    const gkBonus = state.position === "GOL" ? (ga === 0 ? 1 : -ga * 0.25) : 0;
    rating = round1(clamp(base + myGoals * 0.9 + myAssists * 0.6 + impact * 0.35 + result + gkBonus + (rnd() - 0.5) * 0.6 - (minutes < 45 ? 0.3 : 0), 3, 10));
    if (myGoals === 0 && myAssists === 0 && reasons.length === 0) reasons.push("Atuação discreta, poucos lances");
  }
  const motm = rating !== null && rating >= 8;
  return { week: state.week, opponentId: opp.id, home, goalsFor: gf, goalsAgainst: ga, role, minutes, rating, goals: myGoals, assists: myAssists, reasons, motm };
}

/** Avança uma semana: treino + jogo. Função pura: devolve um novo estado. */
export function advanceWeek(prev: PlayerCareerState, plan: WeekPlan, now = Date.now()): PlayerCareerState {
  if (prev.retired) return prev;
  const state: PlayerCareerState = structuredClone(prev);
  const rnd = rngFrom(`${state.seed}|w|${state.season}|${state.week}`);
  applyTraining(state, plan, rnd);
  const role = selectionFor(state, rnd);
  const report = playMatch(state, role, plan, rnd);
  state.pendingMoment = null;
  state.lastMatch = report;
  state.recent = [report, ...state.recent].slice(0, 10);

  if (report.minutes > 0) {
    state.current.apps++;
    if (role === "titular") state.current.starts++;
    state.current.goals += report.goals;
    state.current.assists += report.assists;
    state.current.ratingSum += report.rating ?? 6;
    if (report.motm) state.current.motm++;
    state.energy = clamp(state.energy - report.minutes * 0.25, 5, 100);
    state.form = clamp(state.form + ((report.rating ?? 6) - 6.5) * 6, 10, 99);
    state.trust = clamp(state.trust + ((report.rating ?? 6) - 6.4) * 4, 0, 100);
    state.followers = Math.round(state.followers * (1 + report.goals * 0.04 + (report.motm ? 0.05 : 0.005)));
    state.reputation = clamp(state.reputation + (report.rating ?? 6) / 40 + report.goals * 0.3, 0, 100);
    state.money += report.goals * state.contract.goalBonus;
    if (state.current.apps === 1 && state.history.length === 0) pushNews(state, `Estreia! ${state.nickname} entra em campo pela primeira vez como profissional.`, "good");
    if (report.goals > 0 && state.current.goals === report.goals && state.history.every((h) => h.goals === 0)) pushNews(state, `Primeiro gol da carreira de ${state.nickname}!`, "good");
    if (report.goals >= 3) pushNews(state, `Hat-trick de ${state.nickname}! Atuação de gala.`, "good");
    else if (report.motm) pushNews(state, `${state.nickname} é eleito o melhor em campo (nota ${report.rating?.toFixed(1)}).`, "good");
    else if ((report.rating ?? 6) < 5.2) pushNews(state, `Torcida critica a atuação de ${state.nickname}.`, "bad");
  } else {
    state.energy = clamp(state.energy + 10, 5, 100);
    state.morale = clamp(state.morale - (state.personality === "ambicioso" ? 4 : 2), 0, 100);
    if (role === "fora" && !state.injury && state.recent.slice(0, 4).every((r) => r.minutes === 0) && state.recent.length >= 4)
      pushNews(state, `${state.nickname} está insatisfeito com a falta de oportunidades.`, "bad");
  }
  if (report.goalsFor > report.goalsAgainst) state.morale = clamp(state.morale + 3, 0, 100);
  if (report.goalsFor < report.goalsAgainst) state.morale = clamp(state.morale - 2, 0, 100);
  state.chemistry = clamp(state.chemistry + (report.minutes > 0 ? 1.5 : 0.4), 0, 100);

  if (state.injury) {
    state.injury.weeksLeft -= 1;
    if (state.injury.weeksLeft <= 0) { pushNews(state, `${state.nickname} está recuperado e volta a treinar.`, "neutral"); state.injury = null; }
  }
  state.money += state.contract.salary;

  // convocação: reputação alta e boa forma
  if (state.reputation > 35 && state.form > 70 && rnd() < 0.12) {
    state.nationalCaps++;
    if (rnd() < overall(state) / 250) state.nationalGoals++;
    pushNews(state, `${state.nickname} é convocado para a seleção (${state.nation}).`, "good");
  }

  // janela de transferências no meio da temporada
  const len = seasonLength(state);
  if (state.week === Math.floor(len / 2)) state.offers = generateOffers(state, rnd, 2);

  state.week++;
  if (state.week > len) endSeason(state, rnd);
  state.updatedAt = now;
  return state;
}

// ---------- mercado ----------
export function generateOffers(state: PlayerCareerState, rnd: () => number, max = 3): Offer[] {
  const ovr = overall(state);
  const target = ovr + (state.reputation / 10) + 4;
  const candidates = LEAGUES.flatMap((l) => l.clubs)
    .filter((c) => c.id !== state.clubId && Math.abs(c.strength - target) < 7);
  const offers: Offer[] = [];
  const used = new Set<string>();
  for (let i = 0; i < max * 3 && offers.length < max && candidates.length; i++) {
    const c = candidates[Math.floor(rnd() * candidates.length)]!;
    if (used.has(c.id)) continue;
    used.add(c.id);
    const loan = c.strength > ovr + 6 && state.age < 21 && rnd() < 0.5;
    offers.push({ id: `${state.season}-${state.week}-${c.id}`, clubId: c.id, salary: Math.round((800 + ovr * 25 + c.strength * 12) * (0.9 + rnd() * 0.4)), years: loan ? 1 : 2 + Math.floor(rnd() * 3), loan });
  }
  if (offers.length) pushNews(state, `Rumores: ${offers.map((o) => CLUBS[o.clubId]?.short ?? o.clubId).join(", ")} de olho em ${state.nickname}.`, "neutral");
  return offers;
}

export function acceptOffer(prev: PlayerCareerState, offerId: string, now = Date.now()): PlayerCareerState {
  const offer = prev.offers.find((o) => o.id === offerId);
  const club = offer ? CLUBS[offer.clubId] : undefined;
  if (!offer || !club) return prev;
  const state = structuredClone(prev);
  if (state.current.apps > 0) state.history.push({ ...state.current });
  state.current = emptyLine(state.season, state.age, club.id);
  state.clubId = club.id;
  state.leagueId = club.league;
  state.contract = { clubId: club.id, salary: offer.salary, untilSeason: state.season + offer.years, goalBonus: Math.round(offer.salary / 4), releaseClause: offer.salary * 900 };
  state.trust = 35;
  state.chemistry = 30;
  state.offers = [];
  if (state.week > seasonLength(state)) state.week = seasonLength(state);
  pushNews(state, `${offer.loan ? "Emprestado" : "Contratado"}: ${state.nickname} é do ${club.name}!`, "good");
  state.updatedAt = now;
  return state;
}

export function negotiateOffer(prev: PlayerCareerState, offerId: string): { state: PlayerCareerState; accepted: boolean } {
  const state = structuredClone(prev);
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer) return { state, accepted: false };
  const rnd = rngFrom(`${state.seed}|n|${offerId}|${offer.salary}`);
  const accepted = rnd() < 0.45 + state.reputation / 200;
  if (accepted) offer.salary = Math.round(offer.salary * 1.15);
  else state.offers = state.offers.filter((o) => o.id !== offerId);
  pushNews(state, accepted ? `Clube aceita melhorar a proposta para ${state.nickname}.` : `Negociação esfria: ${CLUBS[offer.clubId]?.short ?? "clube"} desiste.`, accepted ? "good" : "bad");
  return { state, accepted };
}

export function declineOffer(prev: PlayerCareerState, offerId: string): PlayerCareerState {
  const state = structuredClone(prev);
  state.offers = state.offers.filter((o) => o.id !== offerId);
  if (state.personality === "leal") state.trust = clamp(state.trust + 3, 0, 100);
  return state;
}

// ---------- fim de temporada ----------
function endSeason(state: PlayerCareerState, rnd: () => number) {
  const line = state.current;
  const avg = line.apps ? line.ratingSum / line.apps : 0;
  if (line.goals >= 10 && !state.traits.includes("finalizador")) state.traits.push("finalizador");
  if (line.assists >= 8 && !state.traits.includes("construtor")) state.traits.push("construtor");
  if ((state.attrs['bola_parada'] ?? 0) >= 80 && !state.traits.includes("cobrador")) state.traits.push("cobrador");
  if ((state.attrs['lideranca'] ?? 0) >= 78 && !state.traits.includes("lider")) state.traits.push("lider");
  if ((state.attrs['garra'] ?? 0) >= 80 && !state.traits.includes("raçudo")) state.traits.push("raçudo");
  if ((state.attrs['resistencia'] ?? 0) >= 82 && !state.traits.includes("motorzinho")) state.traits.push("motorzinho");
  if (state.position === "GOL" && avg >= 7 && !state.traits.includes("paredao")) state.traits.push("paredao");
  if (state.age <= 21 && avg >= 7 && line.apps >= 10) state.awards.push(`Revelação da temporada ${state.season}`);
  if (line.goals >= 18) state.awards.push(`Artilheiro da temporada ${state.season}`);
  if (avg >= 7.6 && line.apps >= 15) state.awards.push(`Seleção da temporada ${state.season}`);
  if (avg >= 8 && line.apps >= 20 && state.reputation > 70) state.awards.push(`Melhor do mundo — temporada ${state.season}`);

  state.history.push({ ...line });
  pushNews(state, `Fim da temporada ${state.season}: ${line.apps} jogos, ${line.goals} gols, ${line.assists} assistências, nota média ${avg ? avg.toFixed(2) : "—"}.`, "neutral");

  // envelhecimento
  state.age++;
  for (const def of ATTRIBUTES) {
    if (def.group === "goleiro" && state.position !== "GOL") continue;
    const cap = state.potential + 3;
    const g = ageGrowth(state.age, def) * (0.6 + rnd() * 0.8);
    const next = (state.attrs[def.key] ?? 40) + (g > 0 ? g * clamp((cap - overall(state)) / 15, 0.1, 1.2) : g);
    state.attrs[def.key] = round1(clamp(next, 1, 99));
  }
  // potencial vai sendo revelado
  const [lo, hi] = state.potentialSeenRange;
  state.potentialSeenRange = [Math.min(state.potential, lo + 3), Math.max(state.potential, hi - 3)];

  state.season++;
  state.week = 1;
  state.current = emptyLine(state.season, state.age, state.clubId);
  state.energy = 100;
  state.form = 60;
  if (state.contract.untilSeason < state.season) {
    pushNews(state, `Contrato encerrado. ${state.nickname} está livre no mercado.`, "neutral");
    state.offers = generateOffers(state, rnd, 3);
    if (!state.offers.length) {
      const club = clubOf(state);
      state.offers = [{ id: `${state.season}-renov`, clubId: state.clubId, salary: Math.round(state.contract.salary * 1.1), years: 2, loan: false }];
      void club;
    }
  } else {
    state.offers = generateOffers(state, rnd, 2);
  }
  if (state.age >= RETIREMENT_FORCED_AGE) retireInPlace(state, "idade");
}

function retireInPlace(state: PlayerCareerState, reason: "idade" | "escolha" | "lesao") {
  if (state.current.apps > 0 && !state.history.includes(state.current)) state.history.push({ ...state.current });
  state.retired = true;
  state.offers = [];
  pushNews(state, reason === "escolha" ? `${state.nickname} anuncia a aposentadoria aos ${state.age} anos.` : `Fim de carreira para ${state.nickname} (${reason}).`, "neutral");
}

export function retire(prev: PlayerCareerState, now = Date.now()): PlayerCareerState {
  const state = structuredClone(prev);
  retireInPlace(state, "escolha");
  state.updatedAt = now;
  return state;
}

export function careerTotals(state: PlayerCareerState) {
  const lines = [...state.history, ...(state.retired ? [] : [state.current])];
  const apps = lines.reduce((s, l) => s + l.apps, 0);
  const ratingSum = lines.reduce((s, l) => s + l.ratingSum, 0);
  return {
    apps,
    goals: lines.reduce((s, l) => s + l.goals, 0),
    assists: lines.reduce((s, l) => s + l.assists, 0),
    motm: lines.reduce((s, l) => s + l.motm, 0),
    avg: apps ? ratingSum / apps : 0,
    clubs: [...new Set(lines.map((l) => l.clubId))],
  };
}

export function prepareMoments(prev: PlayerCareerState): PlayerCareerState {
  if (prev.pendingMoment?.week === prev.week) return prev;
  return { ...prev, pendingMoment: { week: prev.week, moments: buildMoments(prev) } };
}
