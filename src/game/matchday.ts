import type { MowPattern } from "@/components/game/stadium/textures/grass";
import { getVisual } from "@/game/visual-settings";


/**
 * "Cara" da partida: horário, clima, corte do gramado, vento e público.
 *
 * Tudo é derivado de forma determinística dos clubes envolvidos, então a mesma
 * partida tem sempre o mesmo visual em qualquer aparelho (inclusive no
 * multiplayer, em que os dois jogadores precisam ver o mesmo estádio).
 */

export type TimeOfDay = "dia" | "entardecer" | "noite";
export type Weather = "seco" | "molhado" | "chuva" | "neve";

export interface MatchLook {
  time: TimeOfDay;
  weather: Weather;
  /** 0 = gramado seco, 1 = encharcado (brilho rasante, poças, respingos) */
  wet: number;
  mow: MowPattern;
  /** força do vento (0..1) — bandeiras, rede, grama e chuva inclinada */
  wind: number;
  /** ocupação da arquibancada (0..1) */
  attendance: number;
  /** bola de alta visibilidade (neve / noite com neve) */
  hiVisBall: boolean;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const MOWS: MowPattern[] = ["stripes", "checker", "rings", "diagonal", "wide"];
const TIMES: TimeOfDay[] = ["dia", "entardecer", "noite"];

export function matchLook(homeId: string, awayId: string): MatchLook {
  const h = hash(homeId);
  const seed = hash(homeId + "|" + awayId);
  const time = TIMES[seed % 3] as TimeOfDay;

  // clima: maioria seca, um terço com gramado molhado, chuva mais rara
  const wRoll = (seed >> 3) % 100;
  const weather: Weather =
    wRoll < 56 ? "seco" : wRoll < 82 ? "molhado" : wRoll < 96 ? "chuva" : "neve";

  const wet =
    weather === "chuva" ? 1 : weather === "molhado" ? 0.55 : weather === "neve" ? 0.25 : 0;

  const base: MatchLook = {
    time,
    weather,
    wet: Math.min(1, wet + (time === "noite" ? 0.12 : 0)),
    mow: MOWS[h % MOWS.length] as MowPattern,
    wind: 0.25 + (((seed >> 7) % 100) / 100) * 0.75,
    attendance: 0.62 + (((seed >> 11) % 100) / 100) * 0.38,
    hiVisBall: weather === "neve",
  };

  return applyVisualLook(base, homeId);
}

/** Aplica as escolhas do usuário feitas em /visual sobre o visual sorteado. */
function applyVisualLook(look: MatchLook, homeId: string): MatchLook {
  const v = getVisual();
  const out: MatchLook = { ...look };
  if (v.time !== "auto") out.time = v.time;
  if (v.weather !== "auto") {
    out.weather = v.weather;
    out.wet =
      v.weather === "chuva" ? 1 : v.weather === "molhado" ? 0.55 : v.weather === "neve" ? 0.25 : 0;
    out.hiVisBall = v.weather === "neve";
  }
  const byClub = v.mowByClub[homeId];
  if (byClub) out.mow = byClub;
  else if (v.mow !== "auto") out.mow = v.mow;
  return out;
}

