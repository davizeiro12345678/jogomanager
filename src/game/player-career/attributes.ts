import type { AttributeGroup, PlayerPosition } from "./types";

export interface AttributeDef {
  key: string;
  label: string;
  group: AttributeGroup;
  /** idade em que começa a cair; atributos físicos caem antes */
  declineAge: number;
}

export const ATTRIBUTES: AttributeDef[] = [
  // técnico (8)
  { key: "finalizacao", label: "Finalização", group: "tecnico", declineAge: 32 },
  { key: "chute_longe", label: "Chute de longe", group: "tecnico", declineAge: 32 },
  { key: "passe_curto", label: "Passe curto", group: "tecnico", declineAge: 34 },
  { key: "passe_longo", label: "Passe longo", group: "tecnico", declineAge: 34 },
  { key: "cruzamento", label: "Cruzamento", group: "tecnico", declineAge: 32 },
  { key: "drible", label: "Drible", group: "tecnico", declineAge: 30 },
  { key: "dominio", label: "Domínio", group: "tecnico", declineAge: 33 },
  { key: "bola_parada", label: "Bola parada", group: "tecnico", declineAge: 35 },
  // físico (6)
  { key: "velocidade", label: "Velocidade", group: "fisico", declineAge: 28 },
  { key: "aceleracao", label: "Aceleração", group: "fisico", declineAge: 28 },
  { key: "resistencia", label: "Resistência", group: "fisico", declineAge: 30 },
  { key: "forca", label: "Força", group: "fisico", declineAge: 32 },
  { key: "impulsao", label: "Impulsão", group: "fisico", declineAge: 30 },
  { key: "agilidade", label: "Agilidade", group: "fisico", declineAge: 29 },
  // mental (6)
  { key: "visao", label: "Visão de jogo", group: "mental", declineAge: 35 },
  { key: "decisao", label: "Decisão", group: "mental", declineAge: 35 },
  { key: "posicionamento", label: "Posicionamento", group: "mental", declineAge: 34 },
  { key: "compostura", label: "Compostura", group: "mental", declineAge: 35 },
  { key: "lideranca", label: "Liderança", group: "mental", declineAge: 38 },
  { key: "garra", label: "Garra", group: "mental", declineAge: 33 },
  // defensivo (5)
  { key: "marcacao", label: "Marcação", group: "defensivo", declineAge: 32 },
  { key: "desarme", label: "Desarme", group: "defensivo", declineAge: 31 },
  { key: "carrinho", label: "Carrinho", group: "defensivo", declineAge: 30 },
  { key: "cabeceio", label: "Cabeceio", group: "defensivo", declineAge: 33 },
  { key: "interceptacao", label: "Interceptação", group: "defensivo", declineAge: 33 },
  // goleiro (5)
  { key: "reflexo", label: "Reflexo", group: "goleiro", declineAge: 32 },
  { key: "elasticidade", label: "Elasticidade", group: "goleiro", declineAge: 31 },
  { key: "saida_gol", label: "Saída do gol", group: "goleiro", declineAge: 34 },
  { key: "reposicao", label: "Reposição", group: "goleiro", declineAge: 35 },
  { key: "jogo_aereo", label: "Jogo aéreo (GOL)", group: "goleiro", declineAge: 34 },
];

export const GROUP_LABEL: Record<AttributeGroup, string> = {
  tecnico: "Técnico",
  fisico: "Físico",
  mental: "Mental",
  defensivo: "Defensivo",
  goleiro: "Goleiro",
};

/** Peso de cada atributo no nível geral por posição (os ausentes valem 0). */
const WEIGHTS: Record<PlayerPosition, Record<string, number>> = {
  GOL: { reflexo: 4, elasticidade: 3, saida_gol: 2, reposicao: 1.5, jogo_aereo: 2, posicionamento: 2, compostura: 1.5, decisao: 1 },
  ZAG: { marcacao: 3, desarme: 3, cabeceio: 2.5, interceptacao: 2.5, forca: 2, posicionamento: 2, impulsao: 1, passe_curto: 1, compostura: 1 },
  LAT: { velocidade: 2, aceleracao: 1.5, resistencia: 2, cruzamento: 2, marcacao: 2, desarme: 1.5, passe_curto: 1.5, interceptacao: 1 },
  VOL: { desarme: 2.5, interceptacao: 2.5, passe_curto: 2.5, passe_longo: 1.5, resistencia: 2, visao: 1.5, marcacao: 1.5, forca: 1, decisao: 1.5 },
  MEI: { passe_curto: 3, visao: 3, dominio: 2, drible: 2, passe_longo: 2, decisao: 2, chute_longe: 1, compostura: 1 },
  PON: { velocidade: 3, aceleracao: 2.5, drible: 3, cruzamento: 2, finalizacao: 1.5, agilidade: 2, dominio: 1, passe_curto: 1 },
  ATA: { finalizacao: 4, compostura: 2, posicionamento: 2.5, cabeceio: 1.5, dominio: 1.5, aceleracao: 1.5, velocidade: 1, forca: 1, chute_longe: 1 },
};

export const POSITION_LABEL: Record<PlayerPosition, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LAT: "Lateral",
  VOL: "Volante",
  MEI: "Meia",
  PON: "Ponta",
  ATA: "Atacante",
};

export function overallFor(attrs: Record<string, number>, position: PlayerPosition): number {
  const weights = WEIGHTS[position];
  let sum = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(weights)) {
    sum += (attrs[key] ?? 40) * weight;
    total += weight;
  }
  return Math.round(sum / total);
}

export function keyAttributes(position: PlayerPosition): string[] {
  return Object.entries(WEIGHTS[position])
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
}

export function attrLabel(key: string): string {
  return ATTRIBUTES.find((a) => a.key === key)?.label ?? key;
}

/** Ganho anual esperado pela idade: rápido até 23, estável no auge, queda depois. */
export function ageGrowth(age: number, def: AttributeDef): number {
  if (age >= def.declineAge) return -Math.min(5, 1 + (age - def.declineAge) * 0.9);
  if (age <= 19) return 4;
  if (age <= 23) return 3;
  if (age <= 26) return 1.5;
  return 0.4;
}

export const TRAITS: { key: string; label: string; hint: string }[] = [
  { key: "finalizador", label: "Finalizador", hint: "10+ gols numa temporada" },
  { key: "construtor", label: "Construtor", hint: "8+ assistências numa temporada" },
  { key: "cobrador", label: "Cobrador de falta", hint: "Bola parada 80+" },
  { key: "lider", label: "Líder", hint: "Liderança 78+" },
  { key: "raçudo", label: "Raçudo", hint: "Garra 80+" },
  { key: "vidro", label: "Homem de vidro", hint: "3+ lesões numa temporada" },
  { key: "paredao", label: "Paredão", hint: "Goleiro com nota média 7+" },
  { key: "motorzinho", label: "Motorzinho", hint: "Resistência 82+" },
];
