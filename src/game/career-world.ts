import type { CareerState, MatchLogEntry, NewsKind, Player } from "./types";
import { CLUBS } from "./data/leagues";
import type {
  CareerMemory,
  CareerWorld,
  CoachIdentity,
  InterviewDecision,
  PlayerRelationship,
  SupporterMatchday,
} from "./career-world-types";

export const worldClamp = (value: number, fallback = 50) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? Math.round(value * 10) / 10 : fallback));
const text = (value: unknown, fallback = "", max = 360) =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const number = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
function hash(input: string) {
  let result = 2166136261;
  for (const c of input) result = Math.imul(result ^ c.charCodeAt(0), 16777619);
  return result >>> 0;
}
const stamp = (state: CareerState) => `${state.clubId}:${state.season}:${state.round}`;

function initialIdentity(state: CareerState, seed: number): CoachIdentity {
  const kind = state.manager?.personality ?? "motivador";
  const jitter = (shift: number) => ((seed >>> shift) % 25) - 12;
  const attrs = state.manager?.attrs;
  // The editor stores abilities from 1 to 10; older saves may use 0..100.
  const ability = (value: number | undefined) =>
    value === undefined ? 50 : worldClamp(value <= 10 ? value * 10 : value);
  return {
    assertiveness: worldClamp((kind === "durao" ? 78 : kind === "calmo" ? 28 : 54) + jitter(0)),
    protection: worldClamp((kind === "motivador" ? 78 : kind === "durao" ? 28 : 56) + jitter(3)),
    attacking: worldClamp(
      50 + (ability(attrs?.attack) - ability(attrs?.defense)) * 0.45 + jitter(6),
    ),
    warmth: worldClamp((kind === "calmo" ? 68 : kind === "durao" ? 28 : 55) + jitter(9)),
    youth: worldClamp((kind === "jovem" ? 86 : 54) + jitter(12)),
    reputation: worldClamp(18 + (state.manager?.reputation ?? 3) * 14),
  };
}

function startingBond(
  state: CareerState,
  player: Player,
  identity: CoachIdentity,
): PlayerRelationship {
  const compatible =
    player.personality === "temperamental"
      ? identity.protection > 65
      : player.personality === "profissional"
        ? identity.protection < 45
        : player.age <= 21
          ? identity.youth > 65
          : identity.protection > 55;
  return {
    trust: worldClamp(
      54 + (compatible ? 10 : 0) + (hash(`${state.managerName}:${player.id}`) % 13) - 6,
    ),
    respect: worldClamp(42 + identity.reputation * 0.3),
    lastTalk: "",
  };
}

/** Normalize this personal save just as carefully as the rest of the career.
 * These fields never attest online results, purchases or achievements. */
export function worldFor(state: CareerState): CareerWorld {
  const seed = hash(
    `${state.managerName}|${state.clubId}|${state.manager?.personality ?? "motivador"}|${state.manager?.look.hairColor ?? ""}`,
  );
  const initial = initialIdentity(state, seed);
  const saved = state.world;
  const identity = Object.fromEntries(
    Object.entries(initial).map(([key, fallback]) => [
      key,
      worldClamp(number(saved?.identity?.[key as keyof CoachIdentity], fallback), fallback),
    ]),
  ) as unknown as CoachIdentity;
  const sameClub = saved?.clubId === state.clubId;
  const relationships: CareerWorld["relationships"] = {};
  for (const player of Object.values(state.players)) {
    if (player.clubId !== state.clubId) continue;
    const base = startingBond(state, player, identity);
    const stored = saved?.relationships?.[player.id];
    relationships[player.id] = {
      trust: worldClamp(number(stored?.trust, base.trust)),
      respect: worldClamp(number(stored?.respect, base.respect)),
      lastTalk: text(stored?.lastTalk, "", 80),
    };
  }
  const memoryKinds = new Set([
    "result",
    "interview",
    "signing",
    "sale",
    "youth",
    "title",
    "promise",
    "relationship",
    "renewal",
  ]);
  const memories = (Array.isArray(saved?.memories) ? saved.memories : [])
    .slice(0, 80)
    .filter((item) => item && typeof item.id === "string" && memoryKinds.has(item.kind))
    .map((item) => ({
      id: text(item.id, "", 180),
      clubId: text(item.clubId, state.clubId, 80),
      season: Math.max(1, Math.floor(number(item.season, state.season))),
      round: Math.max(1, Math.floor(number(item.round, state.round))),
      kind: item.kind,
      title: text(item.title, "Memória da carreira", 140),
      detail: text(item.detail),
      sentiment: Math.max(-100, Math.min(100, number(item.sentiment, 0))),
      weight: worldClamp(number(item.weight, 30)),
      ...(item.playerId ? { playerId: text(item.playerId, "", 100) } : {}),
    }));
  return {
    version: 1,
    seed: number(saved?.seed, seed) >>> 0,
    clubId: state.clubId,
    identity,
    fans: {
      trust: worldClamp(
        sameClub ? number(saved?.fans?.trust, state.fanApproval) : state.fanApproval,
      ),
      heat: worldClamp(sameClub ? number(saved?.fans?.heat, 15) : 15),
      patience: worldClamp(sameClub ? number(saved?.fans?.patience, 55) : 55),
      lastReaction: sameClub
        ? text(saved?.fans?.lastReaction, "A torcida aguarda a estreia.")
        : "A torcida aguarda o novo trabalho.",
    },
    relationships,
    memories,
    applied: (Array.isArray(saved?.applied) ? saved.applied : [])
      .filter((key) => typeof key === "string")
      .slice(-240)
      .map((key) => key.slice(0, 180)),
    ...(sameClub && saved?.interviewedAt
      ? { interviewedAt: text(saved.interviewedAt, "", 80) }
      : {}),
  };
}

export function withCareerWorld(state: CareerState): CareerState {
  return { ...state, world: worldFor(state) };
}
export function supporterClimate(state: CareerState): "apoio" | "cobrança" | "protesto" {
  const world = worldFor(state);
  return world.fans.heat >= 68 && (world.fans.trust + state.fanApproval) / 2 < 48
    ? "protesto"
    : world.fans.heat > 40 || state.fanApproval < 45
      ? "cobrança"
      : "apoio";
}
export function supporterAttendance(state: CareerState): number {
  const world = worldFor(state);
  return Math.max(
    0.55,
    Math.min(
      1.08,
      1 + (world.fans.trust - 60) / 500 - world.fans.heat / 550 + (world.fans.patience - 50) / 900,
    ),
  );
}
export function relationshipLabel(value: number) {
  return value >= 80 ? "excelente" : value >= 62 ? "boa" : value >= 42 ? "instável" : "desgastada";
}
/** One occupancy calculation drives both the stadium and the ticket ledger. */
export function supporterOccupancy(state: CareerState): number {
  return Math.max(
    0.35,
    Math.min(
      1,
      ((state.fanApproval ?? 60) / 100 + 0.25 - (state.ticketPrice - 40) / 220) *
        supporterAttendance(state),
    ),
  );
}
export function matchdaySupporters(state: CareerState, home: boolean): SupporterMatchday {
  const world = worldFor(state);
  const climate = supporterClimate(state);
  return {
    occupancy: home ? supporterOccupancy(state) : 0.86,
    climate,
    side: home ? "home" : "away",
    intensity: climate === "apoio" ? world.fans.trust / 100 : world.fans.heat / 100,
  };
}
export function identityLabels(state: CareerState) {
  const { identity } = worldFor(state);
  return {
    imprensa:
      identity.assertiveness >= 68
        ? "provocador"
        : identity.assertiveness <= 42
          ? "diplomático"
          : "pragmático",
    grupo:
      identity.protection >= 65
        ? "protetor"
        : identity.protection <= 40
          ? "disciplinador"
          : "equilibrado",
    filosofia:
      identity.attacking >= 63
        ? "ofensiva"
        : identity.attacking <= 40
          ? "defensiva"
          : "equilibrada",
    trato: identity.warmth <= 38 ? "frio com a imprensa" : "próximo da imprensa",
    base:
      identity.youth >= 70
        ? "excelente com jovens"
        : identity.youth <= 35
          ? "prioriza experiência"
          : "desenvolve com cautela",
  };
}

interface WorldEvent {
  id: string;
  kind: CareerMemory["kind"];
  title: string;
  detail: string;
  sentiment: number;
  weight?: number;
  fan?: number;
  trust?: number;
  heat?: number;
  patience?: number;
  board?: number;
  pressure?: number;
  morale?: number;
  reputation?: number;
  playerId?: string;
  bond?: number;
  season?: number;
  round?: number;
  newsKind?: NewsKind;
}
function retainMemories(memories: CareerMemory[]): CareerMemory[] {
  const recent = memories.slice(0, 58);
  const milestones = memories
    .slice(58)
    .filter((memory) => memory.weight >= 80)
    .slice(0, 22);
  return [...recent, ...milestones];
}
export function rememberWorldEvent(state: CareerState, event: WorldEvent): CareerState {
  const world = worldFor(state);
  if (world.applied.includes(event.id)) return state;
  const fans = {
    trust: worldClamp(world.fans.trust + (event.trust ?? 0)),
    heat: worldClamp(world.fans.heat + (event.heat ?? 0)),
    patience: worldClamp(world.fans.patience + (event.patience ?? 0)),
    lastReaction: event.detail,
  };
  const relationships = { ...world.relationships };
  const players = { ...state.players };
  for (const player of Object.values(players)) {
    if (player.clubId !== state.clubId || (event.playerId && player.id !== event.playerId))
      continue;
    const bond = relationships[player.id]!;
    relationships[player.id] = {
      ...bond,
      trust: worldClamp(bond.trust + (event.bond ?? 0)),
      respect: worldClamp(bond.respect + (event.reputation ?? 0) * 0.25),
    };
    if (event.morale)
      players[player.id] = { ...player, morale: worldClamp(player.morale + event.morale) };
  }
  const memory: CareerMemory = {
    id: event.id,
    clubId: state.clubId,
    season: event.season ?? state.season,
    round: event.round ?? state.round,
    kind: event.kind,
    title: event.title,
    detail: event.detail,
    sentiment: event.sentiment,
    weight: event.weight ?? 40,
    ...(event.playerId ? { playerId: event.playerId } : {}),
  };
  return {
    ...state,
    players,
    fanApproval: worldClamp(state.fanApproval + (event.fan ?? 0)),
    approval: worldClamp(state.approval + (event.board ?? 0)),
    pressure: worldClamp(state.pressure + (event.pressure ?? 0)),
    world: {
      ...world,
      fans,
      relationships,
      identity: {
        ...world.identity,
        reputation: worldClamp(world.identity.reputation + (event.reputation ?? 0)),
      },
      memories: retainMemories([memory, ...world.memories]),
      applied: [...world.applied, event.id].slice(-240),
    },
    news: [
      {
        id: `world-${event.id}`,
        season: state.season,
        round: state.round,
        kind:
          event.newsKind ??
          ((event.kind === "result"
            ? "resultado"
            : event.kind === "signing" || event.kind === "sale"
              ? "mercado"
              : "vestiario") as NewsKind),
        title: event.title,
        body: event.detail,
      },
      ...state.news,
    ].slice(0, 60),
  };
}

export function recordWorldMatch(state: CareerState, match: MatchLogEntry): CareerState {
  const key = `match:${state.clubId}:${match.season}:${match.round}:${match.comp}:${match.opponentId}`;
  const world = worldFor(state);
  if (world.applied.includes(key)) return state;
  const won = match.gf > match.ga,
    lost = match.gf < match.ga;
  const derby = isDerby(state.clubId, match.opponentId);
  const young = match.players.length
    ? match.players.filter((p) => (state.players[p.pid]?.age ?? 99) <= 21 && p.minutes >= 30).length
    : state.lineup.filter((pid) => (state.players[pid]?.age ?? 99) <= 21).length;
  const style = ((state.tactics.mentality - 2) * (world.identity.attacking - 50)) / 90;
  const reaction = won
    ? derby
      ? "A vitória no clássico virou orgulho nas arquibancadas."
      : "A torcida reconhece a resposta do grupo."
    : lost
      ? derby
        ? "A derrota no clássico aumenta as cobranças na porta do clube."
        : "As arquibancadas cobram uma resposta para o próximo jogo."
      : "O empate divide opiniões entre os torcedores.";
  let next = rememberWorldEvent(state, {
    id: key,
    kind: "result",
    season: match.season,
    round: match.round,
    title: `${derby ? "Clássico · " : ""}${won ? "Vitória" : lost ? "Derrota" : "Empate"} contra ${CLUBS[match.opponentId]?.name ?? match.opponentId}: ${match.gf} x ${match.ga}`,
    detail:
      `${match.comp} · ${match.home ? "Em casa" : "Fora de casa"}. ${reaction}` +
      (young
        ? young === 1
          ? " Um jovem ganhou espaço na equipe."
          : ` ${young} jovens ganharam espaço na equipe.`
        : ""),
    sentiment: won ? 7 : lost ? -7 : 0,
    weight: derby ? 85 : state.streak >= 3 ? 65 : 24,
    fan:
      (derby ? (won ? 4 : lost ? -5 : 0) : 0) +
      Math.max(-1.5, Math.min(1.5, style)) +
      (young ? 0.5 : 0),
    trust: won ? 3 : lost ? -4 : 0,
    heat: won ? -9 : lost ? (derby ? 20 : 11) : -2,
    patience: won ? 2 : lost ? -2 : 1,
    pressure: derby ? (lost ? 3 : won ? -2 : 0) : 0,
    reputation: won ? (derby ? 1.2 : 0.5) : lost ? -0.45 : 0,
    morale: world.fans.heat >= 68 && lost ? -1 : world.fans.trust >= 80 && won ? 1 : 0,
  });
  const updated = worldFor(next);
  const relationships = { ...updated.relationships };
  for (const player of Object.values(next.players)) {
    if (player.clubId !== next.clubId) continue;
    const performance = match.players.find((p) => p.pid === player.id);
    const played = performance ? performance.minutes > 20 : state.lineup.includes(player.id);
    const bond = relationships[player.id]!;
    const delta = played
      ? won
        ? 1.1
        : 0.4
      : player.ovr >= 76 && player.injuryWeeks === 0 && !player.suspended
        ? player.personality === "ambicioso"
          ? -2
          : -1
        : 0;
    relationships[player.id] = { ...bond, trust: worldClamp(bond.trust + delta) };
  }
  next = {
    ...next,
    world: {
      ...updated,
      relationships,
      identity: {
        ...updated.identity,
        attacking: worldClamp(
          updated.identity.attacking * 0.975 + state.tactics.mentality * 25 * 0.025,
        ),
        youth: worldClamp(updated.identity.youth + (young ? 0.4 : -0.05)),
      },
    },
  };
  return next;
}

const DERBIES = [
  ["fla", "flu"],
  ["fla", "vas"],
  ["flu", "bot"],
  ["pal", "cor"],
  ["sao", "san"],
  ["gre", "int"],
  ["cam", "cru"],
  ["bah", "vit"],
  ["real", "barca"],
  ["liv", "eve"],
  ["mun", "mci"],
];
export function isDerby(club: string, opponent: string) {
  return DERBIES.some((pair) => pair.includes(club) && pair.includes(opponent));
}

/** Also observes direct UI transfers, renewals and promise settlement. Keys
 * make the same transition harmless when the worker already recorded it. */
export function recordWorldTransition(before: CareerState, after: CareerState): CareerState {
  let next = withCareerWorld(after);
  for (const match of [...(after.matchLog ?? [])].reverse()) {
    if (
      (before.matchLog ?? []).some(
        (old) =>
          old.season === match.season &&
          old.round === match.round &&
          old.comp === match.comp &&
          old.opponentId === match.opponentId &&
          old.home === match.home &&
          old.clubId === match.clubId,
      )
    )
      continue;
    next = recordWorldMatch(next, match);
  }
  if (before.clubId !== after.clubId) return next;
  const roster = Object.values(before.players)
    .filter((p) => p.clubId === before.clubId)
    .sort((a, b) => b.ovr - a.ovr);
  for (const player of Object.values(after.players)) {
    if (player.clubId !== after.clubId) continue;
    if (!before.players[player.id] || before.players[player.id]!.clubId !== before.clubId)
      next = rememberWorldEvent(next, {
        id: `sign:${stamp(after)}:${player.id}`,
        kind: player.age <= 21 ? "youth" : "signing",
        title: `${player.name} chega ao clube`,
        detail:
          player.age <= 21
            ? "A torcida acompanha a aposta em um novo talento. O jovem guarda quem lhe deu a oportunidade."
            : "A contratação aumenta as expectativas para a temporada.",
        sentiment: 5,
        fan: player.ovr >= 76 ? 3 : 1,
        trust: 2,
        heat: -3,
        playerId: player.id,
        bond: 5,
        weight: 55,
      });
    if (
      before.players[player.id] &&
      (player.contractYears ?? 0) > (before.players[player.id]!.contractYears ?? 0)
    )
      next = rememberWorldEvent(next, {
        id: `renew:${stamp(after)}:${player.id}`,
        kind: "renewal",
        title: `${player.name} renova o vínculo`,
        detail: "A permanência reforça a confiança do jogador e a continuidade do projeto.",
        sentiment: 6,
        fan: roster.slice(0, 3).some((p) => p.id === player.id) ? 3 : 0,
        trust: 2,
        playerId: player.id,
        bond: 8,
        weight: 60,
      });
  }
  for (const player of roster)
    if (!after.players[player.id] || after.players[player.id]!.clubId !== after.clubId) {
      const idol = roster.slice(0, 3).some((p) => p.id === player.id) || player.apps >= 35;
      next = rememberWorldEvent(next, {
        id: `sale:${stamp(after)}:${player.id}`,
        kind: "sale",
        title: `${idol ? "A torcida sente a saída de " : "Saída de "}${player.name}`,
        detail: idol
          ? "A saída de um ídolo deixa uma cicatriz: a confiança cai e a cobrança por reposição cresce."
          : "O elenco muda e os torcedores aguardam a reposição.",
        sentiment: idol ? -12 : -3,
        trust: idol ? -10 : -2,
        heat: idol ? 18 : 4,
        patience: idol ? -5 : 0,
        pressure: idol ? 3 : 0,
        playerId: player.id,
        weight: idol ? 95 : 35,
      });
    }
  for (const trophy of after.trophies)
    if (!before.trophies.some((old) => old.season === trophy.season && old.name === trophy.name))
      next = rememberWorldEvent(next, {
        id: `title:${after.clubId}:${trophy.season}:${trophy.name}`,
        kind: "title",
        title: `Título: ${trophy.name}`,
        detail:
          "O título se torna memória do clube. A torcida ganha confiança, o grupo se aproxima e a reputação do treinador cresce.",
        sentiment: 20,
        weight: 100,
        fan: 8,
        trust: 15,
        heat: -35,
        patience: 12,
        morale: 3,
        bond: 4,
        reputation: 4,
        pressure: -8,
      });
  for (const promise of before.promises ?? [])
    if (!(after.promises ?? []).some((p) => p.pid === promise.pid)) {
      const broken = (after.brokenPromises ?? []).includes(promise.pid);
      next = rememberWorldEvent(next, {
        id: `promise:${before.clubId}:${before.season}:${promise.untilRound}:${promise.pid}`,
        kind: "promise",
        title: broken
          ? "Uma promessa quebrada ficou no vestiário"
          : "O grupo reconhece a palavra cumprida",
        detail: broken
          ? "O jogador lembra da promessa de minutos e passa a desconfiar das próximas conversas."
          : "A oportunidade prometida foi entregue; o jogador confia mais no treinador.",
        sentiment: broken ? -12 : 8,
        playerId: promise.pid,
        bond: broken ? -18 : 10,
        trust: broken ? -2 : 2,
        heat: broken ? 4 : -2,
        weight: 80,
      });
    }
  return next;
}

export function applyInterviewDecision(
  state: CareerState,
  decision: InterviewDecision,
): CareerState {
  const world = worldFor(state);
  const key = `interview:${stamp(state)}`;
  if (
    decision.eventKey !== key ||
    world.applied.includes(key) ||
    state.pressRound === state.round ||
    state.sacked
  )
    return state;
  const difficult =
    decision.type === "defeat" || decision.type === "crisis" || decision.type === "sacking";
  const pressure = difficult ? 1.4 : 1;
  const response = decision.response;
  const effects = {
    provoke: {
      fan: difficult ? -3 : 4,
      trust: difficult ? -3 : 2,
      heat: 6,
      board: -1,
      pressure: 5 * pressure,
      bond: 0,
      morale: 1,
    },
    protect: { fan: 1, trust: 2, heat: -4, board: 0, pressure: -1, bond: 3, morale: 2 },
    discipline: {
      fan: 1,
      trust: 0,
      heat: 2,
      board: 2,
      pressure: 0,
      bond: world.identity.protection < 40 ? 1 : -2,
      morale: -1,
    },
    tactical: { fan: 1, trust: 1, heat: -2, board: 1, pressure: -2, bond: 1, morale: 0 },
    youth: { fan: 2, trust: 2, heat: -2, board: 0, pressure: 1, bond: 1, morale: 1 },
    diplomatic: { fan: 1, trust: 1, heat: -3, board: 2, pressure: -1, bond: 1, morale: 0 },
  }[response];
  if (!effects) return state;
  const labels = {
    provoke: "O treinador provoca e aumenta a expectativa",
    protect: "O treinador protege o grupo",
    discipline: "O treinador cobra responsabilidade",
    tactical: "O treinador explica o plano de jogo",
    youth: "O treinador defende espaço para a base",
    diplomatic: "O treinador busca conciliação",
  };
  let next = rememberWorldEvent(state, {
    id: key,
    kind: "interview",
    title: labels[response],
    detail:
      difficult && response === "provoke"
        ? "O discurso inflamado após o mau resultado divide a torcida e amplia a cobrança. A próxima atuação terá peso maior."
        : response === "protect"
          ? "Os jogadores lembram que o treinador assumiu a responsabilidade. A torcida espera uma resposta em campo."
          : response === "youth"
            ? "A torcida apoia a promessa de renovação, mas vai observar se os jovens realmente receberão minutos."
            : "A entrevista repercute na confiança da torcida, no vestiário e na relação com a diretoria.",
    sentiment: effects.fan,
    weight: 65,
    ...effects,
    ...(decision.playerId ? { playerId: decision.playerId } : {}),
  });
  const updated = worldFor(next),
    identity = { ...updated.identity };
  identity.assertiveness = worldClamp(
    identity.assertiveness + (response === "provoke" ? 3 : response === "diplomatic" ? -2 : 0),
  );
  identity.protection = worldClamp(
    identity.protection + (response === "protect" ? 2 : response === "discipline" ? -2 : 0),
  );
  identity.warmth = worldClamp(
    identity.warmth + (response === "diplomatic" ? 1.5 : response === "provoke" ? -1 : 0),
  );
  identity.youth = worldClamp(identity.youth + (response === "youth" ? 2 : 0));
  next = {
    ...next,
    pressRound: state.round,
    world: { ...updated, identity, interviewedAt: stamp(state) },
  };
  return next;
}

/** The older five-question conference keeps its own numeric outcomes and
 * joins the same memory ledger and once-per-round interview allowance. */
export function recordLegacyInterview(
  state: CareerState,
  response: "provoke" | "protect" | "diplomatic",
  headline: string,
): CareerState {
  const key = `interview:${stamp(state)}`;
  const old = worldFor(state);
  if (old.applied.includes(key) || state.pressRound === state.round) return state;
  const next = rememberWorldEvent(state, {
    id: key,
    kind: "interview",
    title: headline,
    detail:
      response === "provoke"
        ? "A coletiva provocadora aumenta a expectativa e deixa uma lembrança na torcida."
        : "A coletiva repercute no grupo e na confiança no trabalho do treinador.",
    sentiment: response === "provoke" ? 2 : 4,
    weight: 65,
    trust: response === "provoke" ? -1 : 2,
    heat: response === "provoke" ? 4 : -3,
    bond: response === "protect" ? 2 : 0,
  });
  const world = worldFor(next);
  return {
    ...next,
    pressRound: state.round,
    world: {
      ...world,
      interviewedAt: stamp(state),
      identity: {
        ...world.identity,
        assertiveness: worldClamp(
          world.identity.assertiveness +
            (response === "provoke" ? 3 : response === "diplomatic" ? -2 : 0),
        ),
        protection: worldClamp(world.identity.protection + (response === "protect" ? 2 : 0)),
        warmth: worldClamp(
          world.identity.warmth + (response === "diplomatic" ? 1 : response === "provoke" ? -1 : 0),
        ),
      },
    },
  };
}

export function recordPlayerConversation(
  before: CareerState,
  after: CareerState,
  pid: string,
  action: string,
  succeeded: boolean,
): CareerState {
  const p = before.players[pid];
  if (!p) return after;
  const key = `talk:${stamp(before)}:${pid}`;
  const world = worldFor(before);
  if (world.applied.includes(key)) return before;
  const next = rememberWorldEvent(after, {
    id: key,
    kind: "relationship",
    ...(action === "liberar" ? { newsKind: "mercado" as const } : {}),
    title: `Conversa com ${p.name}`,
    detail: succeeded
      ? `${p.name} ouviu a mensagem. A forma como foi tratado fica na relação com o treinador.`
      : `${p.name} não aceitou bem a abordagem e vai lembrar desta conversa.`,
    sentiment: succeeded ? 5 : -5,
    playerId: pid,
    bond: succeeded ? (action === "multar" ? 2 : 5) : -6,
    weight: 50,
  });
  const updated = worldFor(next);
  const bond = updated.relationships[pid];
  return bond
    ? {
        ...next,
        world: {
          ...updated,
          relationships: { ...updated.relationships, [pid]: { ...bond, lastTalk: stamp(before) } },
        },
      }
    : next;
}
