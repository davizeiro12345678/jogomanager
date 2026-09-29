// ============================================================================
//  agent.ts
//  Empresário do jogador: quem negocia de verdade não é o clube, é ele.
//
//  Cada alvo do mercado tem um agente com nome, personalidade, taxa e
//  paciência. Oferta baixa irrita (e ele sai da mesa); oferta justa anima e
//  ele pressiona o clube a aceitar. A personalidade muda a concessão, a taxa
//  e o jeito de falar — do "Mercenário" ganancioso ao "Protetor" defensivo.
// ============================================================================

import { makeRng } from "./rng";

export type AgentPersona = "mercenario" | "protetor" | "paciente" | "estrela" | "duro";

export interface Agent {
  name: string;
  persona: AgentPersona;
  /** comissão sobre a transferência, 3..12% */
  feePct: number;
  /** paciência inicial, 2..5 rodadas de conversa */
  patience: number;
}

export const AGENT_LABEL: Record<AgentPersona, string> = {
  mercenario: "Mercenário",
  protetor: "Protetor",
  paciente: "Paciente",
  estrela: "Caça-talentos",
  duro: "Linha-dura",
};

export const AGENT_DESC: Record<AgentPersona, string> = {
  mercenario: "Só pensa na comissão. Taxa alta, mas entrega o jogador rápido.",
  protetor: "Defende o atleta. Odeia pressão e proposta indecente.",
  paciente: "Negocia devagar e quase nunca sai da mesa.",
  estrela: "Adora holofote. Se o clube for grande, facilita tudo.",
  duro: "Não cede um euro. Ou paga, ou nem liga de volta.",
};

const AGENT_FIRST = [
  "Wagner",
  "Giuliano",
  "Nasser",
  "Pini",
  "Kia",
  "Jorge",
  "Mino",
  "Fali",
  "Tamer",
  "Bahia",
  "Renato",
  "Otto",
  "Silvano",
  "Dimitri",
  "Hugo",
  "Saulo",
];
const AGENT_LAST = [
  "Ribeiro",
  "Bertolucci",
  "Al-Khelaifi",
  "Zahavi",
  "Joarabchian",
  "Mendes",
  "Raiola",
  "Ramadani",
  "Hrustanovic",
  "Moraes",
  "Gaúcho",
  "Sterling",
  "Ferreira",
  "Volkov",
  "Marques",
  "Antunes",
];

const PERSONAS: AgentPersona[] = ["mercenario", "protetor", "paciente", "estrela", "duro"];

/** Agente determinístico do alvo: o mesmo jogador, o mesmo agente, sempre. */
export function agentFor(targetId: string): Agent {
  const rng = makeRng(`agent-${targetId}`);
  const persona = PERSONAS[Math.floor(rng() * PERSONAS.length)]!;
  const feePct = persona === "mercenario" ? 10 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 6);
  const patience =
    persona === "paciente" ? 5 : persona === "duro" || persona === "mercenario" ? 2 : 3;
  return {
    name: `${AGENT_FIRST[Math.floor(rng() * AGENT_FIRST.length)]} ${AGENT_LAST[Math.floor(rng() * AGENT_LAST.length)]}`,
    persona,
    feePct,
    patience,
  };
}

export type AgentMood = "furioso" | "irritado" | "neutro" | "animado" | "eufórico";

export function moodFor(heat: number): AgentMood {
  if (heat <= -2) return "furioso";
  if (heat < 0) return "irritado";
  if (heat < 2) return "neutro";
  if (heat < 4) return "animado";
  return "eufórico";
}

export const MOOD_EMOJI: Record<AgentMood, string> = {
  furioso: "😡",
  irritado: "😠",
  neutro: "😐",
  animado: "🙂",
  eufórico: "🤩",
};

export interface AgentState {
  agent: Agent;
  /** calor da conversa: sobe com oferta boa, cai com oferta ruim */
  heat: number;
  /** rodadas de conversa restantes */
  patienceLeft: number;
  walkedAway: boolean;
  /** última cartada dada */
  deadlineGiven: boolean;
  /** última contraproposta sugerida (M€), para a UI exibir */
  counterHint?: number;
}

export function agentConversation(targetId: string): AgentState {
  const agent = agentFor(targetId);
  return { agent, heat: 0, patienceLeft: agent.patience, walkedAway: false, deadlineGiven: false };
}

export interface AgentReply {
  line: string;
  /** multiplicador de tolerância do clube (agente animado facilita) */
  clubHelp: number;
  walkedAway: boolean;
  /** contraproposta sugerida pelo agente (M€), quando houver */
  counter?: number;
}

function pick(rng: () => number, lines: string[]): string {
  return lines[Math.floor(rng() * lines.length)]!;
}

/**
 * Reação do empresário a uma oferta. `ratio` = oferta/pedido.
 *
 * - ratio >= 1: aceita na hora, eufórico;
 * - ratio >= 0.8: anima, sugere contraproposta perto do pedido;
 * - ratio >= 0.55: irrita um pouco, devolve contraproposta dura;
 * - abaixo: ofensa — perde paciência e pode sair da mesa.
 */
export function agentReact(
  conv: AgentState,
  playerName: string,
  ratio: number,
  ask: number,
  seed: string,
): AgentReply {
  const rng = makeRng(`agentline-${seed}`);
  const { agent } = conv;
  if (conv.walkedAway) {
    return { line: `${agent.name} nem atende mais o telefone.`, clubHelp: 0, walkedAway: true };
  }
  if (ratio >= 1) {
    conv.heat = Math.min(5, conv.heat + 2);
    return {
      line: pick(rng, [
        `Fechado! Vou ligar pro clube agora mesmo. ${playerName} vai amar esse projeto.`,
        `É isso! Prepara a caneta que ${playerName} já está fazendo as malas.`,
        `Proposta de gente séria. Considera vendido.`,
      ]),
      clubHelp: 0.12,
      walkedAway: false,
    };
  }
  if (ratio >= 0.8) {
    conv.heat = Math.min(5, conv.heat + 1);
    const counter = Math.round((ask * (0.94 + rng() * 0.04) * 10) / 10);
    conv.counterHint = counter;
    return {
      line: pick(rng, [
        `Estamos perto. Chega a €${counter}M que eu convenço o clube.`,
        `Gostei do tom. €${counter}M e ${playerName} é seu ainda hoje.`,
        `Quase lá. O clube quer €${counter}M — eu banco essa ponte.`,
      ]),
      clubHelp: 0.05,
      walkedAway: false,
      counter,
    };
  }
  if (ratio >= 0.55) {
    conv.heat -= agent.persona === "protetor" ? 2 : 1;
    conv.patienceLeft -= 1;
    const counter = Math.round((ask * (1 + rng() * 0.06) * 10) / 10);
    if (conv.patienceLeft <= 0 && !conv.deadlineGiven) {
      conv.deadlineGiven = true;
      return {
        line: `Última cartada: €${counter}M ou eu desligo e ofereço ${playerName} ao rival. Você tem UMA proposta.`,
        clubHelp: -0.03,
        walkedAway: false,
        counter,
      };
    }
    if (conv.patienceLeft < 0 || (conv.deadlineGiven && conv.patienceLeft <= 0)) {
      conv.walkedAway = true;
      return {
        line: pick(rng, [
          `Chega. Vou oferecer ${playerName} a quem respeita o trabalho dele. Não me liga mais.`,
          `Tempo é dinheiro, e o meu acabou. ${playerName} vai jogar em outro lugar.`,
        ]),
        clubHelp: 0,
        walkedAway: true,
      };
    }
    return {
      line: pick(rng, [
        `€${counter}M. E olha que estou sendo gentil — outro clube já sondou.`,
        `Isso não paga nem a luva. O número é €${counter}M.`,
        `${playerName} vale cada centavo de €${counter}M. Pensa e volta.`,
      ]),
      clubHelp: -0.02,
      walkedAway: false,
      counter,
    };
  }
  // ofensa
  conv.heat -= 2;
  conv.patienceLeft -= agent.persona === "paciente" ? 1 : 2;
  if (conv.patienceLeft <= 0) {
    conv.walkedAway = true;
    return {
      line: pick(rng, [
        `Isso é piada? ${playerName} não é jogador de várzea. Conversa encerrada.`,
        `Você acabou de queimar a ponte. Meu cliente nunca vai jogar aí.`,
      ]),
      clubHelp: 0,
      walkedAway: true,
    };
  }
  return {
    line: pick(rng, [
      `Nem vou levar isso ao clube, por respeito a você. Volta com um número sério.`,
      `Meu telefone quase caiu da mão. Dobra isso aí e a gente conversa.`,
      `${playerName} riu quando eu contei. Tenta de novo, com carinho.`,
    ]),
    clubHelp: -0.05,
    walkedAway: false,
  };
}

/** Fala de abertura do agente quando a negociação começa. */
export function agentOpener(agent: Agent, playerName: string, clubName: string): string {
  const rng = makeRng(`agentopen-${agent.name}-${playerName}`);
  const openers: Record<AgentPersona, string[]> = {
    mercenario: [
      `Sou ${agent.name}. ${playerName} quer sair, o ${clubName} quer dinheiro, eu quero minha parte. Vamos aos números?`,
      `${agent.name}, empresário do ${playerName}. Direto ao ponto: quanto você tem?`,
    ],
    protetor: [
      `Sou ${agent.name} e cuido da carreira do ${playerName} há anos. Dinheiro importa, mas projeto importa mais.`,
      `${agent.name} aqui. Antes dos números: ${playerName} vai jogar ou vai mofar no banco?`,
    ],
    paciente: [
      `${agent.name}, representante do ${playerName}. Sem pressa — boa negociação é a que todo mundo sai feliz.`,
      `Sou ${agent.name}. Senta, toma um café, e me conta o que você planeja pro ${playerName}.`,
    ],
    estrela: [
      `${agent.name}! Você está diante da maior revelação do mercado: ${playerName}. Os holofotes já estão a postos.`,
      `Sou ${agent.name}, e ${playerName} é o nome que vai estampar manchete. Vamos fazer história?`,
    ],
    duro: [
      `${agent.name}. ${playerName} custa caro porque vale caro. Sem choradeira, sem parcelinha criativa.`,
      `Sou ${agent.name}. Vou poupar seu tempo: o número é o número. Pode falar.`,
    ],
  };
  return pick(rng, openers[agent.persona]);
}
