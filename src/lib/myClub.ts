// ============================================================================
//  myClub.ts
//  Clube criado pelo usuário: identidade, escudo, uniforme, estádio e torcida.
//  Guardado no navegador e injetado no mundo do jogo ao carregar o app.
//
//  v2: a injeção deixou de ser destrutiva. O clube que sai da liga é guardado
//  como retrato (snapshot) dentro do próprio pacote, então remover o clube
//  personalizado devolve o mundo original exatamente como era. O assistente
//  também consegue mostrar, antes de fundar, qual clube será substituído.
// ============================================================================

import { CLUBS, LEAGUES } from "@/game/data/leagues";
import {
  setClubStyle,
  type CrestStyle,
  type FansStyle,
  type KitStyle,
  type StadiumStyle,
} from "@/game/customStyle";
import type { Club } from "@/game/types";

const KEY = "manager3d.myclub.v1";
const DRAFTS_KEY = "manager3d.clubdrafts.v1";

export interface MyClub {
  id: string;
  name: string;
  short: string;
  city: string;
  country: string;
  founded: number;
  leagueId: string;
  primary: string;
  secondary: string;
  strength: number;
  crest: CrestStyle;
  kit: KitStyle;
  stadium: StadiumStyle;
  fans: FansStyle;
  /** clube original que saiu da liga para abrir a vaga (guardado inteiro) */
  replaced?: Club;
}

export function readMyClub(): MyClub | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyClub) : null;
  } catch {
    return null;
  }
}

export function writeMyClub(club: MyClub) {
  if (typeof window === "undefined") return;
  const applied = registerMyClub(club);
  window.localStorage.setItem(KEY, JSON.stringify(applied));
}

/** Remove o clube criado e devolve o clube original à liga. */
export function clearMyClub() {
  if (typeof window === "undefined") return;
  const my = readMyClub();
  if (my) restoreWorld(my);
  window.localStorage.removeItem(KEY);
}

/** Qual clube perderia a vaga se o usuário fundasse um clube nesta liga. */
export function clubToBeReplaced(leagueId: string, myId?: string): Club | null {
  const league = LEAGUES.find((l) => l.id === leagueId);
  if (!league || league.clubs.length === 0) return null;
  if (myId) {
    const mine = league.clubs.find((c) => c.id === myId);
    if (mine) return null; // já está na liga, ninguém novo sai
  }
  let weakest = league.clubs[0]!;
  for (const c of league.clubs) if (c.strength < weakest.strength) weakest = c;
  return weakest;
}

/**
 * Injeta o clube no mundo: entra na liga escolhida no lugar do time mais fraco
 * (mantendo o número de participantes) e registra o estilo visual.
 * Devolve o pacote com o retrato do clube substituído preenchido.
 */
export function registerMyClub(my: MyClub): MyClub {
  const league = LEAGUES.find((l) => l.id === my.leagueId);
  if (!league) return my;

  const club: Club = {
    id: my.id,
    name: my.name,
    short: my.short,
    league: league.id,
    primary: my.primary,
    secondary: my.secondary,
    strength: my.strength,
  };

  let replaced = my.replaced;
  const existing = league.clubs.findIndex((c) => c.id === my.id);
  if (existing >= 0) {
    league.clubs[existing] = club;
  } else {
    const victim = replaced ?? clubToBeReplaced(my.leagueId);
    const at = victim ? league.clubs.findIndex((c) => c.id === victim.id) : -1;
    if (victim && at >= 0) {
      replaced = { ...league.clubs[at]! };
      // guarda o original em CLUBS para quem ainda tiver histórico apontando
      // para ele (tabelas antigas, estatísticas, replays) não quebrar.
      league.clubs[at] = club;
    } else {
      league.clubs.push(club);
    }
  }
  CLUBS[club.id] = club;

  setClubStyle(club.id, {
    crest: my.crest,
    kit: my.kit,
    stadium: my.stadium,
    fans: my.fans,
  });

  return replaced ? { ...my, replaced } : my;
}

/** Desfaz a injeção: tira o clube criado e recoloca o original. */
export function restoreWorld(my: MyClub) {
  const league = LEAGUES.find((l) => l.id === my.leagueId);
  if (!league) return;
  const at = league.clubs.findIndex((c) => c.id === my.id);
  if (at < 0) return;
  if (my.replaced) {
    league.clubs[at] = my.replaced;
    CLUBS[my.replaced.id] = my.replaced;
  } else {
    league.clubs.splice(at, 1);
  }
  delete CLUBS[my.id];
}

/** Chamado no boot do app, junto com os outros dados personalizados. */
export function applyMyClubToWorld() {
  const my = readMyClub();
  if (my) registerMyClub(my);
}

export function slugifyClubId(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `my-${base || "clube"}`;
}

/* ------------------------------------------------------- rascunhos */

export interface ClubDraft {
  /** id do rascunho (não é o id do clube) */
  key: string;
  version: number;
  savedAt: number;
  club: MyClub;
}

export function listClubDrafts(): ClubDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_KEY);
    const list = raw ? (JSON.parse(raw) as ClubDraft[]) : [];
    return Array.isArray(list) ? list.sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

/** Salva/atualiza um rascunho versionado. Nunca sobrescreve outro rascunho. */
export function saveClubDraft(club: MyClub, key?: string): ClubDraft {
  const list = listClubDrafts();
  const k = key ?? `draft-${Date.now().toString(36)}`;
  const prev = list.find((d) => d.key === k);
  const draft: ClubDraft = {
    key: k,
    version: (prev?.version ?? 0) + 1,
    savedAt: Date.now(),
    club: { ...club },
  };
  const next = [draft, ...list.filter((d) => d.key !== k)].slice(0, 12);
  if (typeof window !== "undefined") window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
  return draft;
}

export function deleteClubDraft(key: string) {
  if (typeof window === "undefined") return;
  const next = listClubDrafts().filter((d) => d.key !== key);
  window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
}

/* ------------------------------------------------------- pacote */

/** Texto exportável com todo o pacote do clube (identidade + visual). */
export function exportClubPack(club: MyClub): string {
  return JSON.stringify({ format: "manager3d.club", version: 2, club }, null, 2);
}

/** Lê um pacote exportado. Devolve null se o arquivo não for válido. */
export function importClubPack(text: string): MyClub | null {
  try {
    const data = JSON.parse(text) as { format?: string; club?: MyClub };
    if (data.format !== "manager3d.club" || !data.club?.name) return null;
    const c = data.club;
    return {
      ...DEFAULT_MY_CLUB,
      ...c,
      id: c.id || slugifyClubId(c.name),
      crest: { ...DEFAULT_MY_CLUB.crest, ...c.crest },
      kit: { ...DEFAULT_MY_CLUB.kit, ...c.kit },
      stadium: { ...DEFAULT_MY_CLUB.stadium, ...c.stadium },
      fans: { ...DEFAULT_MY_CLUB.fans, ...c.fans },
    };
  } catch {
    return null;
  }
}

export const DEFAULT_MY_CLUB: Omit<MyClub, "id"> = {
  name: "",
  short: "",
  city: "",
  country: "Brasil",
  founded: 2026,
  leagueId: "bra",
  primary: "#0a8f3c",
  secondary: "#ffffff",
  strength: 70,
  crest: { shape: "shield", pattern: "sash", emblem: "ball", founded: 2026 },
  kit: {
    pattern: "stripes",
    base: "#0a8f3c",
    detail: "#ffffff",
    shorts: "#ffffff",
    socks: "#0a8f3c",
    awayBase: "#ffffff",
    awayDetail: "#0a8f3c",
  },
  stadium: { name: "Arena Nova", capacity: 42000, roof: "parcial", seatColor: "#1d6b3f" },
  fans: { size: 1, chant: "carnaval", flagA: "#0a8f3c", flagB: "#ffffff" },
};

export type { StadiumStyle, FansStyle, KitStyle, CrestStyle };
