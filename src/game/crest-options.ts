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
