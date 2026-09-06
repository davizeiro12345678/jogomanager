// ============================================================================
//  myClub.ts
//  Clube criado pelo usuário: identidade, escudo, uniforme, estádio e torcida.
//  Guardado no navegador e injetado no mundo do jogo ao carregar o app.
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
  window.localStorage.setItem(KEY, JSON.stringify(club));
  registerMyClub(club);
}

export function clearMyClub() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * Injeta o clube no mundo: entra na liga escolhida no lugar do time mais fraco
 * (mantendo o número de participantes) e registra o estilo visual.
 */
export function registerMyClub(my: MyClub) {
  const league = LEAGUES.find((l) => l.id === my.leagueId);
  if (!league) return;

  const club: Club = {
    id: my.id,
    name: my.name,
    short: my.short,
    league: league.id,
    primary: my.primary,
    secondary: my.secondary,
    strength: my.strength,
  };

  const existing = league.clubs.findIndex((c) => c.id === my.id);
  if (existing >= 0) {
    league.clubs[existing] = club;
  } else {
    let weakest = 0;
    league.clubs.forEach((c, i) => {
      if (c.strength < league.clubs[weakest]!.strength) weakest = i;
    });
    const dropped = league.clubs[weakest];
    if (dropped) delete CLUBS[dropped.id];
    league.clubs[weakest] = club;
  }
  CLUBS[club.id] = club;

  setClubStyle(club.id, {
    crest: my.crest,
    kit: my.kit,
    stadium: my.stadium,
    fans: my.fans,
  });
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
