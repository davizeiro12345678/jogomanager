import { rememberWorldEvent } from "./career-world";
import type { CareerState } from "./types";

type DecisionImpact = {
  morale?: number;
  board?: number;
  pressure?: number;
  fan?: number;
  trust?: number;
  patience?: number;
  bond?: number;
  condition?: number;
};

interface DecisionOption {
  id: string;
  title: string;
  tradeoff: string;
  outcome: string;
  impact: DecisionImpact;
}

interface DecisionScenario {
  category: string;
  title: string;
  context: string;
  options: DecisionOption[];
  playerId?: string;
}

export type CoachDecision = DecisionScenario & { id: string };

const BOARD: DecisionScenario = {
  category: "Diretoria",
  title: "A diretoria quer respostas",
  context:
    "A pressão chegou ao vestiário. A diretoria pede um plano antes da próxima rodada, enquanto o elenco pede respaldo para atravessar a fase.",
  options: [
    {
      id: "back-squad",
      title: "Assumir a responsabilidade em público",
      tradeoff:
        "Protege a moral e melhora a relação com a torcida. A diretoria tem menos garantias imediatas.",
      outcome: "O treinador protegeu o elenco e assumiu a responsabilidade pela reação.",
      impact: { morale: 4, fan: 3, trust: 3, board: -3 },
    },
    {
      id: "targets",
      title: "Negociar metas de curto prazo",
      tradeoff: "Reduz a pressão agora. Se o time perder o próximo jogo, a diretoria retira apoio.",
      outcome:
        "A diretoria aceitou o plano. A meta da próxima partida é somar pelo menos um ponto.",
      impact: { board: 5, pressure: -4, morale: -2 },
    },
    {
      id: "keep-private",
      title: "Tratar o plano internamente",
      tradeoff: "Preserva a confiança do grupo. A torcida recebe poucas respostas.",
      outcome: "A comissão concentrou o trabalho no vestiário e manteve o plano reservado.",
      impact: { morale: 2, bond: 2, fan: -2, patience: -2 },
    },
  ],
};

const FATIGUE: DecisionScenario = {
  category: "Comissão técnica",
  title: "O departamento médico pede cautela",
  context:
    "A condição média do grupo caiu. A comissão precisa escolher entre uma carga leve e o tempo de treino disponível para ajustar o time.",
  options: [
    {
      id: "lighter",
      title: "Reduzir a carga de campo",
      tradeoff: "Recupera condição do elenco. A diretoria vê menos preparação em campo.",
      outcome: "A equipe reduziu a carga de campo e priorizou recuperação.",
      impact: { condition: 5, board: -2, bond: 2 },
    },
    {
      id: "full",
      title: "Manter o treino coletivo",
      tradeoff: "Demonstra uma resposta imediata à diretoria. O grupo chega menos descansado.",
      outcome: "A comissão manteve o treino coletivo, com custo de condição física.",
      impact: { condition: -3, board: 3, morale: -2 },
    },
    {
      id: "video",
      title: "Trocar parte do treino por vídeo",
      tradeoff: "Alivia a carga e mantém o grupo envolvido. A pressão externa continua.",
      outcome: "A análise em vídeo substituiu parte do trabalho de campo.",
      impact: { condition: 2, morale: 2, pressure: 1 },
    },
  ],
};

const COMMUNITY: DecisionScenario = {
  category: "Torcida",
  title: "Conselho de torcedores pede um encontro",
  context:
    "Representantes da arquibancada querem entender as prioridades da temporada. Jogadores e comissão precisam de tempo para preparar a próxima partida.",
  options: [
    {
      id: "open",
      title: "Fazer uma conversa aberta",
      tradeoff: "Melhora a confiança da torcida. A agenda reduz o tempo de recuperação.",
      outcome: "Torcedores e elenco participaram de uma conversa aberta sobre a temporada.",
      impact: { fan: 4, trust: 5, condition: -2 },
    },
    {
      id: "delegate",
      title: "Enviar um representante do clube",
      tradeoff:
        "Mantém a rotina de preparação e melhora a paciência da torcida com um contato mais discreto.",
      outcome: "O clube ouviu as demandas da torcida por meio de um representante.",
      impact: { trust: 2, patience: 3, board: 1 },
    },
    {
      id: "postpone",
      title: "Adiar até depois da rodada",
      tradeoff: "A comissão ganha tempo para recuperar o elenco. A torcida perde paciência.",
      outcome: "O clube adiou a conversa para preservar a preparação da rodada.",
      impact: { condition: 2, fan: -3, patience: -4 },
    },
  ],
};

function squadMeeting(name: string, playerId: string): DecisionScenario {
  return {
    category: "Vestiário",
    title: "Um jogador quer clareza sobre seu papel",
    context: `${name} pediu uma conversa reservada. O jogador quer saber como será avaliado nas próximas rodadas e o que precisa fazer para ganhar espaço.`,
    playerId,
    options: [
      {
        id: "criteria",
        title: "Definir critérios de desempenho",
        tradeoff:
          "Dá clareza ao jogador e fortalece a relação. A pressão por uma resposta rápida aumenta.",
        outcome: "A comissão alinhou critérios de avaliação e abriu espaço para uma nova conversa.",
        impact: { bond: 5, morale: 2, pressure: 1 },
      },
      {
        id: "listen",
        title: "Ouvir o jogador em particular",
        tradeoff:
          "Recupera a confiança e a moral do atleta. A diretoria recebe pouca sinalização de mudança.",
        outcome: "O treinador ouviu o jogador e manteve a conversa dentro do vestiário.",
        impact: { bond: 4, morale: 4, board: -1 },
      },
      {
        id: "reassess",
        title: "Deixar a avaliação para depois da partida",
        tradeoff: "Reduz a pressão imediata da diretoria. O jogador perde confiança e moral.",
        outcome: "A avaliação do papel do jogador ficou para depois da próxima partida.",
        impact: { bond: -3, morale: -2, pressure: -1 },
      },
    ],
  };
}

/** One durable slot per club and round, independent of which scenario is selected. */
export const coachDecisionId = (career: CareerState) =>
  `coach-decision:${career.clubId}:${career.season}:${career.round}`;

export function coachDecision(career: CareerState): CoachDecision | null {
  const id = coachDecisionId(career);
  if (career.sacked || career.world?.applied?.includes(id)) return null;
  if (career.pressure >= 72) return { id, ...BOARD };

  const players = Object.values(career.players).filter((player) => player.clubId === career.clubId);
  if (players.length === 0) return null;
  const condition = players.reduce((sum, player) => sum + player.condition, 0) / players.length;
  if (condition < 69) return { id, ...FATIGUE };
  const player = players
    .filter((candidate) => candidate.unhappy || candidate.morale < 46)
    .sort((a, b) => a.morale - b.morale || b.ovr - a.ovr || a.id.localeCompare(b.id, "en"))[0];
  if (player) return { id, ...squadMeeting(player.name, player.id) };

  return career.round % 4 === 1 ? { id, ...COMMUNITY } : null;
}

export function applyCoachDecision(
  career: CareerState,
  eventId: string,
  optionId: string,
): CareerState {
  const event = coachDecision(career);
  const option = event?.id === eventId ? event.options.find(({ id }) => id === optionId) : null;
  if (!event || !option) return career;
  const { condition, ...impact } = option.impact;
  const next = rememberWorldEvent(career, {
    ...impact,
    id: eventId,
    kind: "relationship",
    title: option.title,
    detail: option.outcome,
    sentiment: 0,
    weight: 58,
    ...(option.id === "targets" ? { followUp: "board-match-target" } : {}),
    ...(event.playerId ? { playerId: event.playerId } : {}),
  });
  if (!condition) return next;
  const players = { ...next.players };
  for (const player of Object.values(players)) {
    if (player.clubId === next.clubId) {
      players[player.id] = {
        ...player,
        condition: Math.max(0, Math.min(100, player.condition + condition)),
      };
    }
  }
  return { ...next, players };
}
