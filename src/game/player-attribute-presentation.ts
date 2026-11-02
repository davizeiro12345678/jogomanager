import { ATTRIBUTE_KEYS } from "./player-attribute-keys";
import type { AttributeGroup, DetailedAttributes } from "./attributes";
import type { Personality, Position } from "./types";

const labels = [
  "Finalização",
  "Drible",
  "Técnica",
  "Controle de bola",
  "Criatividade",
  "Passe",
  "Visão de jogo",
  "Cruzamento",
  "Domínio",
  "Chute de longe",
  "Bola parada",
  "Marcação",
  "Desarme",
  "Cabeceio",
  "Interceptação",
  "Antecipação",
  "Concentração",
  "Coragem",
  "Combatividade",
  "Velocidade",
  "Aceleração",
  "Força",
  "Fôlego",
  "Agilidade",
  "Impulsão",
  "Equilíbrio",
  "Condição natural",
  "Resistência a lesões",
  "Posicionamento",
  "Frieza",
  "Liderança",
  "Entrega",
  "Disciplina",
  "Decisão",
  "Movimentação sem bola",
  "Trabalho em equipe",
  "Determinação",
  "Regularidade",
  "Reflexo",
  "Encaixe",
  "Saída aérea",
  "Reposição",
  "Um contra um",
  "Comando da área",
  "Saída do gol",
  "Comunicação",
] as const;
export const ATTR_LABELS = Object.fromEntries(
  ATTRIBUTE_KEYS.map((key, index) => [key, labels[index]]),
) as Record<keyof DetailedAttributes, string>;

export const FIELD_GROUPS: AttributeGroup[] = [
  { label: "Técnico", keys: ATTRIBUTE_KEYS.slice(0, 11) },
  { label: "Defensivo", keys: ATTRIBUTE_KEYS.slice(11, 19) },
  { label: "Físico", keys: ATTRIBUTE_KEYS.slice(19, 28) },
  { label: "Mental", keys: ATTRIBUTE_KEYS.slice(28, 38) },
];

export const GK_GROUPS: AttributeGroup[] = [
  {
    label: "Goleiro",
    keys: [
      "reflexes",
      "handling",
      "aerialReach",
      "distribution",
      "oneOnOnes",
      "commandOfArea",
      "rushingOut",
      "communication",
      "positioning",
    ],
  },
  { label: "Com os pés", keys: ["passing", "firstTouch", "composure", "decisions"] },
  {
    label: "Físico",
    keys: ["agility", "jumping", "strength", "stamina", "pace", "balance", "naturalFitness"],
  },
  {
    label: "Mental",
    keys: ["leadership", "workRate", "discipline", "vision", "concentration", "consistency"],
  },
];

export const PERSONALITY_DESC: Record<Personality, string> = {
  líder: "Puxa o grupo, levanta a moral dos companheiros em fases ruins.",
  profissional: "Treina sempre no limite. Evolui de forma constante e raramente reclama.",
  ambicioso: "Quer títulos e vitrine. Fica insatisfeito se o clube não briga em cima.",
  temperamental: "Explosivo. Rende muito bem ou muito mal, e pega mais cartões.",
  caseiro: "Ligado ao clube e à cidade. Difícil de convencer a sair.",
  determinado: "Reage bem à pressão e cresce em jogo decisivo.",
};

export function groupsFor(pos: Position): AttributeGroup[] {
  return pos === "GK" ? GK_GROUPS : FIELD_GROUPS;
}

/** Cor semântica de um atributo pela faixa de valor. */
export function attrTone(v: number) {
  if (v >= 85) return "text-emerald-400";
  if (v >= 74) return "text-primary";
  if (v >= 62) return "text-foreground";
  if (v >= 50) return "text-amber-400";
  return "text-destructive";
}
