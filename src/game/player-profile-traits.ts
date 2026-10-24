import type { DetailedAttributes } from "./attributes";
import type { Player } from "./types";

export const TRAITS = [
  "Cobra faltas",
  "Corta para dentro",
  "Chega na área",
  "Passe em profundidade",
  "Marca por antecipação",
  "Segura a bola",
  "Explode no contra-ataque",
  "Bom no mano a mano",
  "Cabeceador",
  "Líder de vestiário",
  "Motor do meio-campo",
  "Finalizador frio",
] as const;

export type Trait = (typeof TRAITS)[number];

/** Deriva traços e preserva o consumo exato da sequência pseudoaleatória. */
export function pickTraits(p: Player, a: DetailedAttributes, rnd: () => number): Trait[] {
  const out: Trait[] = [];
  const push = (t: Trait) => {
    if (!out.includes(t) && out.length < 3) out.push(t);
  };
  if (a.setPieces >= 78) push("Cobra faltas");
  if (a.finishing >= 80) push("Finalizador frio");
  if (a.heading >= 80) push("Cabeceador");
  if (a.leadership >= 78) push("Líder de vestiário");
  if (a.vision >= 80) push("Passe em profundidade");
  if (a.acceleration >= 84) push("Explode no contra-ataque");
  if (a.marking >= 80) push("Marca por antecipação");
  if (a.workRate >= 82 && p.pos === "MF") push("Motor do meio-campo");
  while (out.length < 2) push(TRAITS[Math.floor(rnd() * TRAITS.length)]!);
  return out;
}
