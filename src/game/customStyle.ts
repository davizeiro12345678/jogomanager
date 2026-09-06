// ============================================================================
//  customStyle.ts
//  Registro leve de estilos personalizados por clube (escudo, uniforme,
//  estádio e torcida). Não importa nada do jogo, para evitar ciclos: qualquer
//  módulo pode ler daqui, e `myClub.ts` é quem preenche.
// ============================================================================

import type { KitPattern } from "./kits";

export type CrestShape =
  | "shield"
  | "round"
  | "pointed"
  | "diamond"
  | "hex"
  | "english"
  | "split"
  | "banner";

export type CrestPattern =
  | "sash"
  | "halves"
  | "stripes"
  | "rings"
  | "quarters"
  | "chevron"
  | "hoop"
  | "rays"
  | "solid";

export type CrestEmblem =
  | "ball"
  | "lion"
  | "eagle"
  | "crown"
  | "anchor"
  | "leaf"
  | "mountain"
  | "bolt";

export interface CrestStyle {
  shape: CrestShape;
  pattern: CrestPattern;
  emblem: CrestEmblem;
  founded: number;
}

export interface KitStyle {
  pattern: KitPattern;
  base: string;
  detail: string;
  shorts: string;
  socks: string;
  awayBase: string;
  awayDetail: string;
}

export type RoofKind = "aberto" | "parcial" | "total";

export interface StadiumStyle {
  name: string;
  capacity: number;
  roof: RoofKind;
  seatColor: string;
}

export type ChantKind = "carnaval" | "operario" | "epico" | "silencioso";

export interface FansStyle {
  /** 0..2 — pequena, média, gigante */
  size: number;
  chant: ChantKind;
  flagA: string;
  flagB: string;
}

const crests = new Map<string, CrestStyle>();
const kits = new Map<string, KitStyle>();
const stadiums = new Map<string, StadiumStyle>();
const fans = new Map<string, FansStyle>();

export function setClubStyle(
  clubId: string,
  style: {
    crest?: CrestStyle;
    kit?: KitStyle;
    stadium?: StadiumStyle;
    fans?: FansStyle;
  },
) {
  if (style.crest) crests.set(clubId, style.crest);
  if (style.kit) kits.set(clubId, style.kit);
  if (style.stadium) stadiums.set(clubId, style.stadium);
  if (style.fans) fans.set(clubId, style.fans);
}

export function clearClubStyle(clubId: string) {
  crests.delete(clubId);
  kits.delete(clubId);
  stadiums.delete(clubId);
  fans.delete(clubId);
}

export const crestStyleFor = (id: string) => crests.get(id);
export const kitStyleFor = (id: string) => kits.get(id);
export const stadiumStyleFor = (id: string) => stadiums.get(id);
export const fansStyleFor = (id: string) => fans.get(id);
