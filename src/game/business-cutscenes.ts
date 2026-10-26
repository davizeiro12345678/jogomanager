import type { Cutscene, CutsceneChoice, CutsceneLine, Speaker } from "@/content/cutscenes";

export type BusinessSceneStage = "negotiation" | "signing" | "presentation";

export interface TransferDealSceneContext {
  /** Stable transaction identity, supplied by the career host. */
  dealId: string;
  clubName: string;
  managerName?: string;
  playerName: string;
  playerId?: string;
  agentName?: string;
  fromName?: string;
  /** Same units as MarketEntry.price. */
  feeMillion: number;
  /** Same units as MarketEntry.wage. */
  wageThousandWeekly: number;
  shirtNumber?: number;
}

export interface SponsorDealSceneContext {
  dealId: string;
  clubName: string;
  managerName?: string;
  sponsorName: string;
  incomeMillionWeekly: number;
  currentRound?: number;
  endsRound?: number;
}

const name = (value: string | undefined, fallback: string) =>
  value?.trim().replace(/\s+/g, " ").slice(0, 100) || fallback;
const amount = (value: number, en: boolean) =>
  Number.isFinite(value) && value >= 0
    ? value.toLocaleString(en ? "en-GB" : "pt-BR", { maximumFractionDigits: 2 })
    : "—";

/** Pure presentation factories. A host must commit/validate a deal before
 * showing signing/presentation. Choices change dialogue only, so replaying,
 * skipping or previewing a scene cannot buy a second player or sponsor. */
export function createTransferDealScene(
  context: TransferDealSceneContext,
  stage: BusinessSceneStage,
  lang = "pt-BR",
): Cutscene {
  const en = !lang.startsWith("pt");
  const club = name(context.clubName, en ? "the club" : "o clube");
  const player = name(context.playerName, en ? "the player" : "o jogador");
  const agent = name(context.agentName, en ? "Player agent" : "Empresário");
  const source = name(context.fromName, en ? "the market" : "o mercado");
  const fee = `€${amount(context.feeMillion, en)} ${en ? "million" : "milhões"}`;
  const wage = `€${amount(context.wageThousandWeekly, en)} ${en ? "thousand per week" : "mil por semana"}`;
  const number =
    Number.isInteger(context.shirtNumber) && context.shirtNumber! > 0
      ? ` ${en ? "Number" : "Número"} ${context.shirtNumber}.`
      : "";
  const id = `deal-transfer-${stage}-${encodeURIComponent(context.dealId).slice(0, 180)}`;
  let index = 0;
  const line = (who: Speaker, pt: string, english: string): CutsceneLine => ({
    id: `${id}.line.${index++}`,
    who,
    text: en ? english : pt,
  });
  const choice = (
    key: string,
    pt: string,
    english: string,
    response: CutsceneLine,
  ): CutsceneChoice => ({
    id: `${id}.choice.${key}`,
    label: en ? english : pt,
    response: [response],
  });

  let lines: CutsceneLine[];
  if (stage === "negotiation") {
    const question = line(
      "manager",
      "Vamos alinhar a chegada antes de decidir a proposta.",
      "Let's discuss the arrival before deciding on the offer.",
    );
    question.choices = [
      choice(
        "project",
        "Explicar o projeto esportivo",
        "Explain the sporting project",
        line(
          "agent",
          `${player} quer entender seu papel. Competição por espaço e um plano claro de adaptação fazem parte da conversa.`,
          `${player} wants to understand the role. Competition for a place and a clear settling-in plan are part of the discussion.`,
        ),
      ),
      choice(
        "terms",
        "Revisar valores e salário",
        "Review fee and wages",
        line(
          "president",
          `A proposta em análise é de ${fee}, com salário de ${wage}. A decisão final será registrada no mercado.`,
          `The offer under review is ${fee}, with wages of ${wage}. The final decision will be recorded in the market.`,
        ),
      ),
    ];
    lines = [
      line(
        "narrator",
        `Na sala de negociações do ${club}, a proposta por ${player} está sobre a mesa.`,
        `In the ${club} negotiation room, the offer for ${player} is on the table.`,
      ),
      line(
        "scout",
        `${player} chega de ${source}. Nosso relatório está disponível para decidir como ele pode ajudar o elenco.`,
        `${player} comes from ${source}. Our report is available to assess how the player can help the squad.`,
      ),
      line(
        "agent",
        `O pedido é de ${fee} e ${wage}. Quero ouvir o plano do ${club}.`,
        `The asking fee is ${fee}, with wages of ${wage}. I want to hear the ${club} plan.`,
      ),
      question,
      line(
        "narrator",
        "A reunião termina. Confira a proposta e confirme sua decisão no mercado de transferências.",
        "The meeting ends. Review the offer and confirm your decision in the transfer market.",
      ),
    ];
  } else if (stage === "signing") {
    lines = [
      line(
        "narrator",
        `${player} e os representantes do ${club} se reúnem para a assinatura.`,
        `${player} and the ${club} representatives gather for the signing.`,
      ),
      line(
        "president",
        `A contratação foi registrada: taxa de transferência de ${fee} e salário de ${wage}.`,
        `The signing has been recorded: a ${fee} transfer fee and wages of ${wage}.`,
      ),
      line(
        "agent",
        "Os termos estão conferidos. Agora começa a integração com a comissão técnica.",
        "The terms have been checked. Integration with the coaching staff begins now.",
      ),
      line(
        "captain",
        `É uma honra vestir a camisa do ${club}. Quero conquistar meu espaço trabalhando.`,
        `It is an honour to wear the ${club} shirt. I want to earn my place through hard work.`,
      ),
      line(
        "manager",
        `Bem-vindo, ${player}. Vamos preparar sua chegada ao grupo com cuidado.`,
        `Welcome, ${player}. We'll prepare your arrival in the squad carefully.`,
      ),
    ];
  } else {
    const question = line(
      "press",
      `Como ${player} entra no projeto do ${club}?`,
      `How does ${player} fit into the ${club} project?`,
    );
    question.choices = [
      choice(
        "adaptation",
        "Dar tempo para a adaptação",
        "Allow time to settle in",
        line(
          "manager",
          "Vamos respeitar a adaptação, avaliar os treinos e construir o entrosamento com o elenco.",
          "We'll respect the settling-in period, assess training and build understanding with the squad.",
        ),
      ),
      choice(
        "competition",
        "Destacar a competição por espaço",
        "Emphasise competition for places",
        line(
          "manager",
          "A chegada aumenta nossas opções. Todos terão de conquistar espaço pelo trabalho diário.",
          "The arrival gives us more options. Everyone will have to earn a place through daily work.",
        ),
      ),
    ];
    lines = [
      line(
        "narrator",
        `Câmeras se voltam para ${player}. A camisa do ${club} é apresentada à imprensa.${number}`,
        `Cameras turn to ${player}. The ${club} shirt is presented to the press.${number}`,
      ),
      question,
      line(
        "captain",
        "Quero conhecer os companheiros e começar os treinos. A resposta vem dentro de campo.",
        "I want to meet my teammates and start training. The answer will come on the pitch.",
      ),
      line(
        "narrator",
        "A foto oficial encerra a apresentação. O reforço segue para sua primeira sessão com o grupo.",
        "The official photo closes the presentation. The new signing heads to the first session with the squad.",
      ),
    ];
  }
  return {
    id,
    title: en
      ? {
          negotiation: `Negotiating for ${player}`,
          signing: `${player}: contract signing`,
          presentation: `Introducing ${player}`,
        }[stage]
      : {
          negotiation: `Negociação por ${player}`,
          signing: `${player}: assinatura do contrato`,
          presentation: `Apresentação de ${player}`,
        }[stage],
    art: stage === "presentation" ? "press" : "transfer",
    hybrid: true,
    mood: stage === "negotiation" ? "neutral" : "good",
    language: en ? "en" : "pt-BR",
    speakerNames: {
      captain: player,
      agent,
      ...(context.managerName ? { manager: name(context.managerName, "") } : {}),
    },
    business: { kind: "transfer", stage, clubName: club, subjectName: player },
    lines,
  };
}

export function createSponsorDealScene(
  context: SponsorDealSceneContext,
  stage: BusinessSceneStage,
  lang = "pt-BR",
): Cutscene {
  const en = !lang.startsWith("pt");
  const club = name(context.clubName, en ? "the club" : "o clube");
  const sponsor = name(context.sponsorName, en ? "the sponsor" : "o patrocinador");
  const income = `€${amount(context.incomeMillionWeekly, en)} ${en ? "million per week" : "milhões por semana"}`;
  const end =
    Number.isInteger(context.endsRound) && context.endsRound! > 0
      ? en
        ? ` until round ${context.endsRound}`
        : ` até a rodada ${context.endsRound}`
      : "";
  const id = `deal-sponsor-${stage}-${encodeURIComponent(context.dealId).slice(0, 180)}`;
  let index = 0;
  const line = (who: Speaker, pt: string, english: string): CutsceneLine => ({
    id: `${id}.line.${index++}`,
    who,
    text: en ? english : pt,
  });
  let lines: CutsceneLine[];
  if (stage === "negotiation") {
    const question = line(
      "manager",
      "Como podemos apresentar uma parceria consistente com o clube?",
      "How can we present a partnership that fits the club?",
    );
    question.choices = [
      {
        id: `${id}.choice.community`,
        label: en ? "Discuss fans and community" : "Conversar sobre torcida e comunidade",
        response: [
          line(
            "agent",
            "Queremos aproximar a marca da torcida com uma comunicação responsável e atividades no calendário do clube.",
            "We want to bring the brand closer to fans through responsible communication and activities in the club calendar.",
          ),
        ],
      },
      {
        id: `${id}.choice.planning`,
        label: en ? "Review the financial plan" : "Revisar o planejamento financeiro",
        response: [
          line(
            "president",
            `A proposta prevê ${income}${end}. Vamos avaliar sua contribuição para o planejamento antes da confirmação.`,
            `The offer provides ${income}${end}. We'll assess its contribution to our planning before confirmation.`,
          ),
        ],
      },
    ];
    lines = [
      line(
        "narrator",
        `Representantes de ${sponsor} visitam a diretoria do ${club}.`,
        `${sponsor} representatives visit the ${club} board.`,
      ),
      line(
        "agent",
        `Nossa proposta de patrocínio é de ${income}${end}.`,
        `Our sponsorship offer is ${income}${end}.`,
      ),
      question,
      line(
        "narrator",
        "A proposta permanece em análise. A confirmação será feita no painel financeiro.",
        "The offer remains under review. Confirmation will take place in the finances panel.",
      ),
    ];
  } else if (stage === "signing") {
    lines = [
      line(
        "narrator",
        `${club} e ${sponsor} se reúnem para formalizar a parceria.`,
        `${club} and ${sponsor} gather to formalise the partnership.`,
      ),
      line(
        "president",
        `O acordo foi registrado: ${income}${end}. O planejamento financeiro já reflete os termos confirmados.`,
        `The agreement has been recorded: ${income}${end}. Financial planning now reflects the confirmed terms.`,
      ),
      line(
        "agent",
        "Vamos coordenar a comunicação da parceria com o clube e respeitar seu calendário esportivo.",
        "We'll coordinate partnership communications with the club and respect its sporting calendar.",
      ),
      line(
        "manager",
        "Com o acordo definido, seguimos focados na preparação do elenco.",
        "With the agreement settled, we remain focused on preparing the squad.",
      ),
    ];
  } else {
    const question = line(
      "press",
      `O que a parceria com ${sponsor} representa para o ${club}?`,
      `What does the ${sponsor} partnership mean for ${club}?`,
    );
    question.choices = [
      {
        id: `${id}.choice.stability`,
        label: en ? "Emphasise financial planning" : "Valorizar o planejamento financeiro",
        response: [
          line(
            "president",
            "O acordo ajuda nosso planejamento. O trabalho esportivo continuará sendo avaliado com responsabilidade.",
            "The agreement supports our planning. Sporting work will continue to be assessed responsibly.",
          ),
        ],
      },
      {
        id: `${id}.choice.fans`,
        label: en ? "Thank the supporters" : "Agradecer à torcida",
        response: [
          line(
            "manager",
            "A torcida dá significado a esta camisa. Queremos honrar essa relação em cada treino e em cada partida.",
            "Our supporters give this shirt its meaning. We want to honour that relationship in every session and every match.",
          ),
        ],
      },
    ];
    lines = [
      line(
        "narrator",
        `Os representantes posam diante do painel de ${club} e ${sponsor}.`,
        `The representatives pose in front of the ${club} and ${sponsor} backdrop.`,
      ),
      question,
      line(
        "agent",
        `É um prazer fazer parte deste capítulo do ${club}.`,
        `It is a pleasure to be part of this chapter at ${club}.`,
      ),
      line(
        "narrator",
        "O anúncio oficial encerra a coletiva da parceria.",
        "The official announcement closes the partnership press conference.",
      ),
    ];
  }
  return {
    id,
    title: en
      ? {
          negotiation: `Sponsorship meeting: ${sponsor}`,
          signing: `Partnership signing: ${sponsor}`,
          presentation: `Partnership announcement: ${sponsor}`,
        }[stage]
      : {
          negotiation: `Reunião de patrocínio: ${sponsor}`,
          signing: `Assinatura da parceria: ${sponsor}`,
          presentation: `Anúncio da parceria: ${sponsor}`,
        }[stage],
    art: stage === "presentation" ? "press" : "board",
    hybrid: true,
    mood: stage === "negotiation" ? "neutral" : "good",
    language: en ? "en" : "pt-BR",
    speakerNames: {
      agent: sponsor,
      ...(context.managerName ? { manager: name(context.managerName, "") } : {}),
    },
    business: { kind: "sponsor", stage, clubName: club, subjectName: sponsor },
    lines,
  };
}
