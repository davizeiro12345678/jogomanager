// ============================================================================
//  customData.ts
//  Dados cadastrados pelo próprio usuário (clubes, jogadores e competições),
//  guardados no navegador. Permite personalizar nome, cores, escudo, uniforme,
//  estádio e força de qualquer clube, criar/editar/mover jogadores e montar
//  competições próprias — tudo aplicado sobre os dados oficiais do jogo.
// ============================================================================

import { CLUBS, LEAGUES } from "@/game/data/leagues";
import {
  setClubStyle,
  type CrestStyle,
  type FansStyle,
  type KitStyle,
  type StadiumStyle,
} from "@/game/customStyle";
import type { Club, League, Player, Position } from "@/game/types";

const KEY = "manager3d.custom.v1";

export interface ClubOverride {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  /** imagem enviada pelo usuário (data URL) */
  badge?: string;
  /** força geral do clube (35-99), sobrepõe o valor oficial */
  force?: number;
  /** escudo vetorial customizado (usado quando não há imagem enviada) */
  crest?: CrestStyle;
  kit?: KitStyle;
  stadium?: StadiumStyle;
  fans?: FansStyle;
}

export interface CustomPlayer {
  id: string;
  clubId: string;
  name: string;
  pos: Position;
  age: number;
  ovr: number;
  contractYears: number;
  /** salário semanal em milhões */
  wage: number;
  /** valor de mercado em milhões */
  value: number;
  photo?: string;
  /** número da camisa (opcional; sorteado se ausente) */
  number?: number;
  nationality?: string;
  /** teto de evolução (0-99) */
  potential?: number;
  personality?: Player["personality"];
  /** atributos manuais (0-99); quando ausentes são derivados do overall */
  pace?: number;
  shooting?: number;
  passing?: number;
  defending?: number;
  physical?: number;
}

export type CompetitionFormat = "pontos-corridos" | "mata-mata" | "grupos-mata-mata";

export interface CustomCompetition {
  id: string;
  name: string;
  country: string;
  clubIds: string[];
  format: CompetitionFormat;
  /** quantidade de rebaixados (só relevante em pontos corridos) */
  relegated: number;
  /** vagas para torneios continentais */
  continentalSlots: number;
}

export interface CustomData {
  clubs: Record<string, ClubOverride>;
  players: CustomPlayer[];
  competitions: CustomCompetition[];
}

const EMPTY: CustomData = { clubs: {}, players: [], competitions: [] };

export function readCustom(): CustomData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CustomData>;
    return {
      clubs: parsed.clubs ?? {},
      players: parsed.players ?? [],
      competitions: parsed.competitions ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function writeCustom(data: CustomData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* espaço cheio: ignora */
  }
  applyCustomToWorld();
}

export function upsertClub(override: ClubOverride) {
  const data = readCustom();
  data.clubs[override.id] = override;
  writeCustom(data);
}

export function removeClub(id: string) {
  const data = readCustom();
  delete data.clubs[id];
  writeCustom(data);
}

export function upsertPlayer(player: CustomPlayer) {
  const data = readCustom();
  const i = data.players.findIndex((p) => p.id === player.id);
  if (i >= 0) data.players[i] = player;
  else data.players.push(player);
  writeCustom(data);
}

export function removePlayer(id: string) {
  const data = readCustom();
  data.players = data.players.filter((p) => p.id !== id);
  writeCustom(data);
}

/** move um jogador cadastrado para outro clube, mantendo o restante da ficha */
export function movePlayer(id: string, clubId: string) {
  const data = readCustom();
  const player = data.players.find((p) => p.id === id);
  if (!player) return;
  player.clubId = clubId;
  writeCustom(data);
}

export function customPlayersFor(clubId: string): CustomPlayer[] {
  return readCustom().players.filter((p) => p.clubId === clubId);
}

/* -------------------------------------------------------------------------- */
/*  Competições customizadas                                                  */
/* -------------------------------------------------------------------------- */

export function upsertCompetition(comp: CustomCompetition) {
  const data = readCustom();
  const i = data.competitions.findIndex((c) => c.id === comp.id);
  if (i >= 0) data.competitions[i] = comp;
  else data.competitions.push(comp);
  writeCustom(data);
}

export function removeCompetition(id: string) {
  const data = readCustom();
  data.competitions = data.competitions.filter((c) => c.id !== id);
  writeCustom(data);
}

export const FORMAT_LABEL: Record<CompetitionFormat, string> = {
  "pontos-corridos": "Pontos corridos",
  "mata-mata": "Mata-mata",
  "grupos-mata-mata": "Grupos + mata-mata",
};

/* -------------------------------------------------------------------------- */
/*  Escudos enviados pelo usuário                                             */
/* -------------------------------------------------------------------------- */

const badges = new Map<string, string>();

export function badgeFor(clubId: string): string | undefined {
  return badges.get(clubId);
}

/** aplica nome, cores, escudo, força, uniforme e estádio sobre os clubes do jogo */
export function applyCustomToWorld() {
  if (typeof window === "undefined") return;
  const data = readCustom();
  badges.clear();
  for (const o of Object.values(data.clubs)) {
    const club = CLUBS[o.id];
    if (!club) continue;
    if (o.name.trim()) club.name = o.name.trim();
    if (o.short.trim()) club.short = o.short.trim().toUpperCase().slice(0, 4);
    if (o.primary) club.primary = o.primary;
    if (o.secondary) club.secondary = o.secondary;
    if (typeof o.force === "number") club.strength = Math.max(35, Math.min(99, Math.round(o.force)));
    if (o.badge) badges.set(o.id, o.badge);
    setClubStyle(o.id, {
      ...(o.crest ? { crest: o.crest } : {}),
      ...(o.kit ? { kit: o.kit } : {}),
      ...(o.stadium ? { stadium: o.stadium } : {}),
      ...(o.fans ? { fans: o.fans } : {}),
    });
  }

  applyCustomCompetitions(data.competitions);
}

/**
 * Registra competições customizadas como ligas jogáveis: os clubes escolhidos
 * entram numa liga própria (o motor de temporada trata como pontos corridos
 * independente do formato salvo; mata-mata e grupos ficam registrados como
 * metadado da competição para exibição e uso futuro).
 */
function applyCustomCompetitions(competitions: CustomCompetition[]) {
  for (const comp of competitions) {
    const clubs = comp.clubIds.map((id) => CLUBS[id]).filter(Boolean) as Club[];
    if (clubs.length < 2) continue;
    const league: League = {
      id: `custom-${comp.id}`,
      name: comp.name,
      country: comp.country || "Personalizado",
      flag: "🏆",
      clubs,
    };
    const idx = LEAGUES.findIndex((l) => l.id === league.id);
    if (idx >= 0) LEAGUES[idx] = league;
    else LEAGUES.push(league);
  }
}

export function competitionMeta(id: string): CustomCompetition | undefined {
  return readCustom().competitions.find((c) => c.id === id);
}

/* -------------------------------------------------------------------------- */
/*  Importação / Exportação                                                   */
/* -------------------------------------------------------------------------- */

export function exportCustomJson(): string {
  return JSON.stringify(readCustom(), null, 2);
}

/** Valida e substitui os dados customizados a partir de um JSON exportado. */
export function importCustomJson(raw: string): { ok: true } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Arquivo inválido: não é um JSON válido." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Arquivo inválido: formato inesperado." };
  }
  const obj = parsed as Partial<CustomData>;
  if (obj.clubs !== undefined && typeof obj.clubs !== "object") {
    return { ok: false, error: "Campo 'clubs' inválido no arquivo." };
  }
  if (obj.players !== undefined && !Array.isArray(obj.players)) {
    return { ok: false, error: "Campo 'players' inválido no arquivo." };
  }
  if (obj.competitions !== undefined && !Array.isArray(obj.competitions)) {
    return { ok: false, error: "Campo 'competitions' inválido no arquivo." };
  }
  const clean: CustomData = {
    clubs: (obj.clubs as Record<string, ClubOverride>) ?? {},
    players: (obj.players as CustomPlayer[]) ?? [],
    competitions: (obj.competitions as CustomCompetition[]) ?? [],
  };
  for (const p of clean.players) {
    if (!p.id || !p.clubId || !p.name || !p.pos) {
      return { ok: false, error: "Há um jogador sem id, clube, nome ou posição no arquivo." };
    }
  }
  writeCustom(clean);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Conversão para jogador do jogo                                            */
/* -------------------------------------------------------------------------- */

function attrsFor(pos: Position, ovr: number) {
  const c = (v: number) => Math.max(35, Math.min(99, Math.round(v)));
  if (pos === "GK")
    return { pace: c(ovr - 20), shooting: c(ovr - 40), passing: c(ovr - 12), defending: c(ovr), physical: c(ovr - 4) };
  if (pos === "DF")
    return { pace: c(ovr - 4), shooting: c(ovr - 25), passing: c(ovr - 8), defending: c(ovr + 4), physical: c(ovr + 3) };
  if (pos === "MF")
    return { pace: c(ovr - 2), shooting: c(ovr - 6), passing: c(ovr + 4), defending: c(ovr - 5), physical: c(ovr - 2) };
  return { pace: c(ovr + 3), shooting: c(ovr + 4), passing: c(ovr - 4), defending: c(ovr - 22), physical: c(ovr - 2) };
}

/** transforma um cadastro do usuário num jogador completo do jogo */
export function toGamePlayer(cp: CustomPlayer, number: number): Player {
  const derived = attrsFor(cp.pos, cp.ovr);
  return {
    id: cp.id,
    clubId: cp.clubId,
    name: cp.name,
    pos: cp.pos,
    age: cp.age,
    number: cp.number ?? number,
    ovr: cp.ovr,
    pace: cp.pace ?? derived.pace,
    shooting: cp.shooting ?? derived.shooting,
    passing: cp.passing ?? derived.passing,
    defending: cp.defending ?? derived.defending,
    physical: cp.physical ?? derived.physical,
    condition: 96,
    morale: 82,
    goals: 0,
    assists: 0,
    apps: 0,
    wage: cp.wage,
    value: cp.value,
    yellows: 0,
    suspended: false,
    injuryWeeks: 0,
    contractYears: cp.contractYears,
    ...(cp.potential !== undefined ? { potential: cp.potential } : {}),
    ...(cp.personality !== undefined ? { personality: cp.personality } : {}),
    ...(cp.nationality !== undefined ? { nationality: cp.nationality } : {}),
    ...(cp.photo !== undefined ? { photo: cp.photo } : {}),
  };
}
