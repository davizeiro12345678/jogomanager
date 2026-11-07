// ============================================================================
//  CrestBuilder.tsx
//  Controles compartilhados para montar um escudo vetorial (forma, estampa e
//  símbolo) e o uniforme (padrão + cores). Usado em /clube/novo e no editor.
// ============================================================================

import type { CrestEmblem, CrestPattern, CrestShape } from "@/game/customStyle";

import type { KitPattern } from "@/game/kits";

export const CREST_SHAPES: CrestShape[] = [
  "shield",
  "round",
  "pointed",
  "diamond",
  "hex",
  "english",
  "split",
  "banner",
];

export const CREST_PATTERNS: CrestPattern[] = [
  "sash",
  "halves",
  "stripes",
  "rings",
  "quarters",
  "chevron",
  "hoop",
  "rays",
  "solid",
];

export const CREST_EMBLEMS: CrestEmblem[] = [
  "ball",
  "lion",
  "eagle",
  "crown",
  "anchor",
  "leaf",
  "mountain",
  "bolt",
];

export const KIT_PATTERNS: KitPattern[] = [
  "solid",
  "stripes",
  "hoops",
  "sash",
  "halves",
  "checks",
  "band",
  "sleeves",
  "gradient",
  "pin",
];

export const EMBLEM_LABEL: Record<CrestEmblem, string> = {
  ball: "Bola",
  lion: "Leão",
  eagle: "Águia",
  crown: "Coroa",
  anchor: "Âncora",
  leaf: "Folha",
  mountain: "Montanha",
  bolt: "Raio",
};

export const SHAPE_LABEL: Record<CrestShape, string> = {
  shield: "Escudo",
  round: "Circular",
  pointed: "Pontudo",
  diamond: "Losango",
  hex: "Hexagonal",
  english: "Inglês",
  split: "Dividido",
  banner: "Estandarte",
};
export const CREST_PATTERN_LABEL: Record<CrestPattern, string> = {
  sash: "Faixa diagonal",
  halves: "Duas metades",
  stripes: "Listras verticais",
  rings: "Anéis",
  quarters: "Quatro partes",
  chevron: "Faixa em V",
  hoop: "Faixa horizontal",
  rays: "Raios",
  solid: "Cor única",
};
export const KIT_PATTERN_LABEL: Record<KitPattern, string> = {
  solid: "Cor única",
  stripes: "Listras verticais",
  hoops: "Listras horizontais",
  sash: "Faixa diagonal",
  halves: "Duas metades",
  checks: "Quadriculado",
  band: "Faixa central",
  sleeves: "Mangas contrastantes",
  gradient: "Degradê",
  pin: "Listras finas",
  quarters: "Quatro partes",
  chevron: "Faixa em V",
  diagonal: "Listras diagonais",
  shadow: "Tom sobre tom",
  argyle: "Losangos",
  mesh: "Trama",
};
