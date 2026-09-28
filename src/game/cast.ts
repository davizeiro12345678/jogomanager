// ============================================================================
//  cast.ts
//  Elenco fixo da carreira: quem fala nas cutscenes tem nome e rosto.
//
//  Antes os locutores eram cargos genéricos ("Presidente", "Auxiliar"). Agora
//  cada carreira sorteia (de forma determinística por clube+temporada) um nome
//  e uma aparência para cada papel — o presidente cobra pelo nome, o médico
//  dá más notícias, o empresário liga pedindo renovação. O capitão vem do
//  elenco real; o resto é figurino com identidade.
// ============================================================================

import type { Speaker } from "@/content/cutscenes";
import type { ManagerLook } from "./types";

/** Um integrante do elenco: nome, cargo e rosto. */
export interface CastMember {
  name: string;
  role: string;
  look: ManagerLook;
}

export type Cast = Record<Speaker, CastMember>;

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Ricardo",
  "Marcos",
  "Paulo",
  "André",
  "Felipe",
  "Gustavo",
  "Rafael",
  "Bruno",
  "Thiago",
  "Diego",
  "Leandro",
  "Rodrigo",
  "Fernando",
  "Eduardo",
  "Carlos",
  "João",
  "Antônio",
  "Francisco",
  "Luciano",
  "Vagner",
  "Otávio",
  "Caio",
  "Henrique",
  "Igor",
];
const LAST = [
  "Almeida",
  "Barbosa",
  "Cardoso",
  "Duarte",
  "Moreira",
  "Teixeira",
  "Peixoto",
  "Sampaio",
  "Vasconcellos",
  "Queiroz",
  "Menezes",
  "Camargo",
  "Drummond",
  "Falcão",
  "Gurgel",
  "Toledo",
  "Abranches",
  "Bittencourt",
  "Coimbra",
  "Sales",
  "Xavier",
  "Macedo",
  "Freitas",
  "Lacerda",
];
const FEMALE_FIRST = [
  "Mariana",
  "Camila",
  "Beatriz",
  "Fernanda",
  "Patrícia",
  "Renata",
  "Juliana",
  "Aline",
  "Larissa",
  "Vanessa",
  "Priscila",
  "Daniela",
];
const HAIR_COLORS = ["#1c1c1e", "#1c1c1e", "#3a2a1c", "#5a4632", "#8a8a8e", "#c0c0c4", "#7a4a22"];

function fullName(rng: () => number, female = false): string {
  const first = female
    ? FEMALE_FIRST[Math.floor(rng() * FEMALE_FIRST.length)]!
    : FIRST[Math.floor(rng() * FIRST.length)]!;
  const last = LAST[Math.floor(rng() * LAST.length)]!;
  return `${first} ${last}`;
}

/**
 * Rosto determinístico por papel. Terno para cartolas, agasalho para a
 * comissão, casual para torcida e imprensa de rua.
 */
function lookFor(role: Speaker, rng: () => number): ManagerLook {
  const suit: Speaker[] = ["president", "agent", "press"];
  const tracksuit: Speaker[] = ["assistant", "doctor", "scout", "referee", "captain"];
  return {
    skin: Math.floor(rng() * 6),
    hair: Math.floor(rng() * 7),
    hairColor: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)]!,
    beard: role === "press" && rng() < 0.3 ? 0 : Math.floor(rng() * 5),
    outfit: suit.includes(role) ? 0 : tracksuit.includes(role) ? 1 : 2,
  };
}

/**
 * Elenco da carreira. `managerName` e `captainName` vêm do jogo real; o resto
 * é sorteado por clube+temporada (estável durante a temporada, renova na
 * próxima — como a vida real troca diretor e jornalista).
 */
export function castFor(clubId: string, season: number, managerName: string): Cast {
  const rng = makeRng(hashSeed(`${clubId}|${season}|cast`));
  const member = (role: Speaker, title: string, female = false): CastMember => ({
    name: fullName(rng, female),
    role: title,
    look: lookFor(role, rng),
  });
  const managerLook: ManagerLook = {
    skin: Math.floor(rng() * 6),
    hair: Math.floor(rng() * 7),
    hairColor: HAIR_COLORS[0]!,
    beard: 0,
    outfit: 1,
  };
  return {
    manager: { name: managerName, role: "Treinador", look: managerLook },
    president: member("president", "Presidente"),
    press: member("press", "Jornalista", rng() < 0.4),
    captain: { name: "Capitão", role: "Capitão", look: lookFor("captain", rng) },
    narrator: { name: "", role: "", look: managerLook },
    commentator: member("commentator", "Comentarista"),
    referee: member("referee", "Árbitro"),
    assistant: member("assistant", "Auxiliar técnico"),
    doctor: member("doctor", "Médico", rng() < 0.35),
    scout: member("scout", "Olheiro"),
    agent: member("agent", "Empresário"),
    fan: { name: "Torcida", role: "Arquibancada", look: lookFor("fan", rng) },
  };
}

/** Nome exibido de um locutor: elenco > nome real > cargo genérico. */
export function speakerName(
  cast: Cast | undefined,
  fallback: Record<Speaker, string>,
  who: Speaker,
  overrides?: Partial<Record<Speaker, string>>,
): string {
  const over = overrides?.[who];
  if (over) return over;
  const member = cast?.[who];
  if (member && member.name) return member.name;
  return fallback[who];
}
