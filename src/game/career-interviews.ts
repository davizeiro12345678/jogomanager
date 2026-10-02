import type { Cutscene } from "@/content/cutscenes";
import { CLUBS } from "./data/leagues";
import { detectUnhappy } from "./unhappy";
import { identityLabels, isDerby, supporterClimate, worldFor } from "./career-world";
import type { CareerState } from "./types";
import type { InterviewType, PressResponse } from "./career-world-types";

export const INTERVIEW_LABELS: Record<InterviewType, string> = {
  routine: "Próxima partida",
  derby: "Antes do clássico",
  defeat: "Depois da derrota",
  title: "Depois do título",
  signing: "Apresentação de contratação",
  unhappy: "Jogador insatisfeito",
  crisis: "Crise interna",
  continental: "Final continental",
  streak: "Sequência de vitórias",
  sacking: "Risco de demissão",
  renewal: "Renovação contratual",
};
export interface InterviewContext {
  type: InterviewType;
  available: boolean;
  reason: string;
  playerId?: string;
}

export function interviewContexts(state: CareerState): InterviewContext[] {
  const world = worldFor(state),
    last = state.matchLog?.[0];
  const upcoming = state.fixtures.find(
    (f) =>
      f.round >= state.round &&
      f.homeGoals === null &&
      (f.home === state.clubId || f.away === state.clubId),
  );
  const opponent = upcoming ? (upcoming.home === state.clubId ? upcoming.away : upcoming.home) : "";
  const recent = (kind: string) =>
    world.memories.find(
      (memory) =>
        memory.kind === kind &&
        memory.clubId === state.clubId &&
        memory.season === state.season &&
        memory.round >= state.round - 3,
    );
  const arrival = recent("signing") ?? recent("youth"),
    renewal = recent("renewal");
  const dissatisfied = detectUnhappy(state)
    .filter((g) => state.players[g.pid]?.clubId === state.clubId)
    .sort((a, b) => b.level - a.level)[0];
  const finals = state.cups?.some(
    (cup) =>
      cup.id === "continental" &&
      !cup.out &&
      cup.ties.some(
        (tie) =>
          tie.round === 3 &&
          tie.hg === null &&
          (tie.home === state.clubId || tie.away === state.clubId),
      ),
  );
  const player =
    renewal?.playerId ??
    Object.values(state.players)
      .filter((p) => p.clubId === state.clubId && (p.contractYears ?? 2) <= 1)
      .sort((a, b) => b.ovr - a.ovr)[0]?.id;
  const contexts: InterviewContext[] = [
    {
      type: "routine",
      available: !state.sacked,
      reason: upcoming
        ? `Preparação para ${CLUBS[opponent]?.name ?? opponent}.`
        : "O próximo compromisso do clube.",
    },
    {
      type: "derby",
      available: Boolean(upcoming && isDerby(state.clubId, opponent)),
      reason: "Um rival histórico aparece no próximo compromisso.",
    },
    {
      type: "defeat",
      available: Boolean(
        last && last.gf < last.ga && last.season === state.season && last.round >= state.round - 2,
      ),
      reason: last ? `Último resultado: ${last.gf} x ${last.ga}.` : "Aguardando um resultado.",
    },
    {
      type: "title",
      available: Boolean(recent("title")),
      reason: "Uma conquista recente marca a coletiva.",
    },
    {
      type: "signing",
      available: Boolean(arrival),
      reason: arrival?.title ?? "Uma nova contratação abre este assunto.",
      ...(arrival?.playerId ? { playerId: arrival.playerId } : {}),
    },
    {
      type: "unhappy",
      available: Boolean(dissatisfied),
      reason: dissatisfied?.detail ?? "O assunto surge quando alguém tem uma reclamação.",
      ...(dissatisfied ? { playerId: dissatisfied.pid } : {}),
    },
    {
      type: "crisis",
      available:
        state.pressure >= 65 ||
        supporterClimate(state) === "protesto" ||
        Object.values(state.players).filter((p) => p.clubId === state.clubId && p.morale < 40)
          .length >= 4,
      reason: "Pressão e ambiente do vestiário entram na pauta.",
    },
    {
      type: "continental",
      available: Boolean(finals),
      reason: "A classificação para uma final continental abre esta coletiva.",
    },
    {
      type: "streak",
      available: state.streak >= 3,
      reason: `Sequência atual: ${state.streak} vitória(s).`,
    },
    {
      type: "sacking",
      available: state.pressure >= 75 && !state.sacked,
      reason: "A diretoria cobra resultados para manter o treinador.",
    },
    {
      type: "renewal",
      available: Boolean(player),
      reason: player
        ? `${state.players[player]?.name ?? "Jogador"} e a continuidade do projeto.`
        : "Um contrato perto do fim ou recém-renovado abre este assunto.",
      ...(player ? { playerId: player } : {}),
    },
  ];
  return contexts.map((context) => ({ ...context, available: context.available && !state.sacked }));
}

const RESPONSES: Record<PressResponse, { label: string; hint: string }> = {
  provoke: {
    label: "Provocar e assumir o desafio",
    hint: "Empolga em bons momentos; aumenta a cobrança e pode dividir a torcida na crise.",
  },
  protect: {
    label: "Proteger o grupo",
    hint: "Fortalece a confiança dos jogadores e assume responsabilidade pública.",
  },
  discipline: {
    label: "Cobrar responsabilidade",
    hint: "Agrada à diretoria; o grupo reage conforme a sua relação com o treinador.",
  },
  tactical: {
    label: "Explicar o plano de jogo",
    hint: "Reduz a tensão com uma leitura concreta da atuação.",
  },
  youth: {
    label: "Defender espaço para os jovens",
    hint: "Reforça sua identidade com a base e cria expectativa por oportunidades.",
  },
  diplomatic: {
    label: "Conciliar com imprensa e torcida",
    hint: "Melhora a relação com a diretoria e acalma a repercussão.",
  },
};

export function buildCareerInterview(state: CareerState, type: InterviewType): Cutscene | null {
  const context = interviewContexts(state).find((item) => item.type === type);
  if (!context?.available) return null;
  const world = worldFor(state),
    labels = identityLabels(state),
    last = state.matchLog?.[0];
  const player = context.playerId ? state.players[context.playerId] : undefined;
  const lastOpponent = last ? (CLUBS[last.opponentId]?.name ?? last.opponentId) : "o adversário";
  const questions: Record<InterviewType, string> = {
    routine: `${state.managerName}, qual é o plano para a próxima partida? O seu trabalho vem sendo descrito como ${labels.filosofia}.`,
    derby: `A cidade espera o clássico. O senhor vai entrar para vencer ou teme a pressão da rivalidade?`,
    defeat: `O ${CLUBS[state.clubId]?.short ?? "clube"} perdeu por ${last?.ga ?? 0} a ${last?.gf ?? 0} para ${lastOpponent}. Quem assume a responsabilidade?`,
    title: `Depois do título, o que este grupo representa para o clube e o que vem a seguir?`,
    signing: `${player?.name ?? "O novo reforço"} chega com expectativa. Qual será o papel dele no seu projeto?`,
    unhappy: `${player?.name ?? "Um jogador"} demonstrou insatisfação. O senhor perdeu o controle do vestiário?`,
    crisis: `A pressão está em ${Math.round(state.pressure)} e o ambiente preocupa. Como o senhor pretende reconquistar o grupo e as arquibancadas?`,
    continental: `O clube está na final continental. Como equilibrar coragem e responsabilidade na maior decisão da temporada?`,
    streak: `São ${state.streak} vitórias seguidas. Este é o seu melhor trabalho ou o time ainda pode crescer?`,
    sacking: `A sua permanência está sendo discutida pela diretoria. O senhor ainda tem o apoio do elenco?`,
    renewal: `${player?.name ?? "O elenco"} e a continuidade do projeto estão na pauta. O clube deve priorizar renovação ou mudança?`,
  };
  const difficult = ["defeat", "crisis", "sacking", "unhappy"].includes(type);
  const answers: Record<PressResponse, string> = {
    provoke: difficult
      ? "Eu aceito a cobrança. Ainda acredito no nosso trabalho e quero a resposta em campo. Quem nos dá por vencidos vai ter de esperar o próximo jogo."
      : "Nós entramos para impor o nosso jogo. Respeito o adversário, mas não escondo a ambição. Podem cobrar coragem desta equipe.",
    protect: player
      ? `A responsabilidade é minha. Vou ouvir ${player.name} em particular e proteger o grupo. Uma pessoa não vai carregar sozinha a situação do clube.`
      : "A responsabilidade é minha. Os jogadores trabalham todos os dias e terão o meu apoio. O que precisamos corrigir será tratado dentro do clube.",
    discipline: player
      ? `${player.name} é importante, mas precisa cumprir o que o grupo exige. Todos terão critérios claros, trabalho e responsabilidade.`
      : "O apoio existe, mas compromisso é obrigatório. Vamos cobrar cada detalhe no treino e todos responderão pelo que entregam ao grupo.",
    tactical: `Queremos ${state.tactics.mentality >= 3 ? "recuperar a bola cedo e atacar com mais gente" : state.tactics.mentality <= 1 ? "reduzir os espaços e escolher a hora de acelerar" : "equilibrar proteção e criação"}. O foco será posicionamento, tomada de decisão e continuidade, com a formação ${state.tactics.formation}.`,
    youth:
      "Não vou fechar as portas para quem vem da base. A oportunidade precisa ser acompanhada de trabalho e proteção. O desenvolvimento faz parte deste projeto.",
    diplomatic:
      "Entendo a expectativa da torcida e a pergunta da imprensa. Vamos conversar, corrigir o que for preciso e trabalhar com a diretoria. O clube precisa de confiança e de uma resposta concreta.",
  };
  const remembered = world.memories.find(
    (memory) =>
      memory.weight >= 65 &&
      (memory.playerId === context.playerId ||
        memory.kind === "interview" ||
        memory.kind === "title"),
  );
  const eventKey = `interview:${state.clubId}:${state.season}:${state.round}`;
  const order: PressResponse[] =
    world.identity.assertiveness >= 68
      ? ["provoke", "protect", "tactical", "discipline", "diplomatic", "youth"]
      : world.identity.protection <= 40
        ? ["discipline", "tactical", "diplomatic", "protect", "youth", "provoke"]
        : ["protect", "diplomatic", "tactical", "youth", "discipline", "provoke"];
  return {
    id: `career-interview-${type}`,
    title: INTERVIEW_LABELS[type],
    art: "press",
    mood: difficult ? "bad" : type === "title" || type === "streak" ? "good" : "neutral",
    lines: [
      {
        who: "narrator",
        text: `Temporada ${state.season}, rodada ${state.round}. ${context.reason}${remembered ? ` A imprensa ainda lembra: ${remembered.title.toLowerCase()}.` : ""}`,
      },
      { who: "press", text: questions[type] },
      {
        who: "manager",
        text: `${state.managerName} decide como responder.`,
        choices: order.map((response) => ({
          ...RESPONSES[response],
          response: [
            { who: "manager", text: answers[response] },
            {
              who: "press",
              text:
                difficult && response === "provoke"
                  ? "Essa declaração aumenta a expectativa. A torcida vai cobrar já no próximo jogo."
                  : response === "protect"
                    ? "Os jogadores ouviram a defesa. Agora todos esperam a resposta da equipe."
                    : "A declaração vai repercutir no clube. Veremos como esse compromisso aparece em campo.",
            },
            {
              who: "narrator",
              text:
                response === "provoke" && difficult
                  ? "A entrevista divide opiniões e reforça a cobrança. Esta escolha passa a fazer parte da história do treinador."
                  : "O grupo, a diretoria e a torcida guardam a mensagem. A identidade do treinador começa a refletir suas decisões.",
            },
          ],
          effect: {
            careerDecision: {
              type,
              response,
              eventKey,
              ...(context.playerId ? { playerId: context.playerId } : {}),
            },
          },
        })),
      },
    ],
  };
}
