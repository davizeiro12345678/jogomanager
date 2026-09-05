// ============================================================================
//  customData.ts
//  Dados cadastrados pelo próprio usuário (clubes e jogadores), guardados no
//  navegador. Permite personalizar nome, cores e escudo de qualquer clube e
//  criar jogadores próprios, que entram no elenco ao começar uma carreira.
// ============================================================================

import { CLUBS } from "@/game/data/leagues";
import type { Player, Position } from "@/game/types";

const KEY = "manager3d.custom.v1";

export interface ClubOverride {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  /** imagem enviada pelo usuário (data URL) */
  badge?: string;
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
}

export interface CustomData {
  clubs: Record<string, ClubOverride>;
  players: CustomPlayer[];
}

const EMPTY: CustomData = { clubs: {}, players: [] };

export function readCustom(): CustomData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CustomData>;
    return { clubs: parsed.clubs ?? {}, players: parsed.players ?? [] };
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

export function customPlayersFor(clubId: string): CustomPlayer[] {
  return readCustom().players.filter((p) => p.clubId === clubId);
}

/* -------------------------------------------------------------------------- */
/*  Escudos enviados pelo usuário                                             */
/* -------------------------------------------------------------------------- */

const badges = new Map<string, string>();

export function badgeFor(clubId: string): string | undefined {
  return badges.get(clubId);
}

/** aplica nome, cores e escudo cadastrados sobre os clubes do jogo */
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
    if (o.badge) badges.set(o.id, o.badge);
  }
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
  return {
    id: cp.id,
    clubId: cp.clubId,
    name: cp.name,
    pos: cp.pos,
    age: cp.age,
    number,
    ovr: cp.ovr,
    ...attrsFor(cp.pos, cp.ovr),
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
  };
}
