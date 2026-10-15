/**
 * Roteiro das cutscenes 2D. Cada cena tem um cenário ilustrado e animado
 * (desenhado em SVG no componente Cutscene) e uma sequência de falas.
 */
export type SceneArt =
  | "arrival"
  | "press"
  | "dressing"
  | "trophy"
  | "training"
  | "gym"
  | "tactics"
  | "staff"
  | "board"
  | "transfer"
  | "tunnel"
  | "kitroom"
  | "pitchentry"
  | "celebration"
  | "defeat"
  | "farewell"
  | "bus"
  | "office"
  | "medical"
  | "gala";

export type Speaker =
  | "manager"
  | "president"
  | "press"
  | "captain"
  | "narrator"
  | "commentator"
  | "referee"
  | "assistant"
  | "doctor"
  | "scout"
  | "agent"
  | "fan";

export const SPEAKER_LABEL: Record<Speaker, string> = {
  manager: "Você",
  president: "Presidente",
  press: "Imprensa",
  captain: "Capitão",
  narrator: "",
  commentator: "Comentarista",
  referee: "Árbitro",
  assistant: "Auxiliar",
  doctor: "Médico",
  scout: "Olheiro",
  agent: "Empresário",
  fan: "Torcida",
};

/** Consequência numérica de uma escolha: soma nos medidores (trava 0..100). */
export interface ChoiceEffect {
  morale?: number;
  condition?: number;
  approval?: number;
  fanApproval?: number;
  pressure?: number;
  headline?: string;
  careerDecision?: import("@/game/career-world-types").InterviewDecision;
}

export interface CutsceneChoice {
  /** Stable identity for voice assets and authored branch analytics. */
  id?: string;
  label: string;
  hint?: string;
  response: CutsceneLine[];
  effect?: ChoiceEffect;
}

export interface CutsceneLine {
  /** Stable identity for voice assets; kept optional for external custom scenes. */
  id?: string;
  who: Speaker;
  text: string;
  /** escolha jogável: pausa o avanço e mostra as opções */
  choices?: CutsceneChoice[];
}

export type SceneMood = "good" | "bad" | "neutral";

export interface Cutscene {
  id: string;
  title: string;
  art: SceneArt;
  mood?: SceneMood;
  /** cena híbrida: encenação com câmera em 3D real sobre as camadas ilustradas */
  hybrid?: boolean;
  /** Presentation only; deal transactions remain owned by the career host. */
  business?: {
    kind: "transfer" | "sponsor";
    stage: "negotiation" | "signing" | "presentation";
    clubName: string;
    subjectName: string;
  };
  lines: CutsceneLine[];
}

function scene(
  id: string,
  title: string,
  art: SceneArt,
  lines: CutsceneLine[],
  mood: SceneMood = "neutral",
): Cutscene {
  return { id, title, art, mood, lines };
}

export const CUTSCENES: Record<string, Cutscene> = {
  /* ------------------------------------------------ história */
  arrival: scene("arrival", "Chegada ao clube", "arrival", [
    {
      id: "arrival.line.001",
      who: "narrator",
      text: "O carro para em frente ao centro de treinamento. Câmeras por toda parte.",
    },
    {
      id: "arrival.line.002",
      who: "president",
      text: "Bem-vindo. A torcida está ansiosa — e a diretoria também.",
    },
    {
      id: "arrival.line.003",
      who: "manager",
      text: "Vim para trabalhar. Me dê tempo e time para brigar lá em cima.",
    },
    {
      id: "arrival.line.004",
      who: "narrator",
      text: "Portões se abrem. O escudo do clube brilha sob o sol da tarde.",
    },
  ]),
  press: scene("press", "Apresentação à imprensa", "press", [
    { id: "press.line.001", who: "press", text: "Qual é a meta para a temporada?" },
    {
      id: "press.line.002",
      who: "manager",
      text: "Jogar bem, competir em tudo e devolver orgulho a esta camisa.",
    },
    { id: "press.line.003", who: "press", text: "E se os resultados demorarem?" },
    { id: "press.line.004", who: "manager", text: "Aí eu trabalho mais. Não existe atalho." },
    {
      id: "press.line.005",
      who: "narrator",
      text: "Os flashes disparam. O relógio da sua era começa agora.",
    },
  ]),
  dressing: scene("dressing", "Vestiário antes do jogo", "dressing", [
    { id: "dressing.line.001", who: "captain", text: "O grupo está pronto, professor." },
    {
      id: "dressing.line.002",
      who: "manager",
      text: "Intensidade nos primeiros minutos. A torcida faz o resto.",
    },
    {
      id: "dressing.line.003",
      who: "narrator",
      text: "Chuteiras batem no piso. O corredor já ruge lá fora.",
    },
  ]),
  tunnel: scene("tunnel", "Túnel de acesso", "tunnel", [
    {
      id: "tunnel.line.001",
      who: "narrator",
      text: "Luz no fim do túnel, som abafado de setenta mil pessoas.",
    },
    { id: "tunnel.line.002", who: "captain", text: "Ninguém baixa a cabeça hoje." },
    { id: "tunnel.line.003", who: "manager", text: "Vamos jogar como treinamos. Simples assim." },
  ]),
  title: scene(
    "title",
    "Comemoração de título",
    "celebration",
    [
      {
        id: "title.line.001",
        who: "narrator",
        text: "Confete, fogos e a taça erguida sob o estádio lotado.",
      },
      { id: "title.line.002", who: "fan", text: "É campeão! É campeão!" },
      {
        id: "title.line.003",
        who: "manager",
        text: "Isto é de vocês. Amanhã já pensamos na próxima.",
      },
    ],
    "good",
  ),

  /* ------------------------------------------------ treino */
  "training-warmup": scene("training-warmup", "Aquecimento", "training", [
    {
      id: "training-warmup.line.001",
      who: "narrator",
      text: "Seis da manhã. Cones espalhados, orvalho ainda no gramado.",
    },
    {
      id: "training-warmup.line.002",
      who: "assistant",
      text: "Grupo completo. Dois em trabalho reduzido.",
    },
    {
      id: "training-warmup.line.003",
      who: "manager",
      text: "Começa leve. Quero todo mundo inteiro no domingo.",
    },
  ]),
  "training-tactics": scene("training-tactics", "Trabalho tático", "tactics", [
    {
      id: "training-tactics.line.001",
      who: "manager",
      text: "Linha alta, encurtando o campo. A bola volta rápido pra gente.",
    },
    {
      id: "training-tactics.line.002",
      who: "captain",
      text: "E se eles jogarem em contra-ataque longo?",
    },
    {
      id: "training-tactics.line.003",
      who: "manager",
      text: "Aí o zagueiro mais rápido cobre e o lateral fecha por dentro.",
    },
    {
      id: "training-tactics.line.004",
      who: "assistant",
      text: "Ensaiado. Repetimos mais dez vezes até virar hábito.",
    },
  ]),
  "training-finishing": scene("training-finishing", "Finalização", "training", [
    {
      id: "training-finishing.line.001",
      who: "narrator",
      text: "Bola após bola cruzando a área. O goleiro reclama do ritmo.",
    },
    {
      id: "training-finishing.line.002",
      who: "manager",
      text: "Chute com o pé de apoio firme. Colocação antes de força.",
    },
    {
      id: "training-finishing.line.003",
      who: "captain",
      text: "Se o domingo for assim, ganhamos fácil.",
    },
  ]),
  "training-gym": scene("training-gym", "Academia e recuperação", "gym", [
    {
      id: "training-gym.line.001",
      who: "doctor",
      text: "Cargas controladas. Dois atletas voltam de lesão nesta semana.",
    },
    {
      id: "training-gym.line.002",
      who: "manager",
      text: "Sem pressa. Prefiro perder um jogo a perder um jogador.",
    },
  ]),
  "training-talk": scene("training-talk", "Conversa individual", "staff", [
    {
      id: "training-talk.line.001",
      who: "manager",
      text: "Sei que você quer jogar mais. Eu preciso de você pronto quando chamar.",
    },
    { id: "training-talk.line.002", who: "captain", text: "Eu estou. Só quero minha chance." },
    { id: "training-talk.line.003", who: "manager", text: "Ela vem. Continue treinando assim." },
  ]),

  /* ------------------------------------------------ salas do clube */
  trophyroom: scene("trophyroom", "Sala de troféus", "trophy", [
    {
      id: "trophyroom.line.001",
      who: "narrator",
      text: "Vidro, luz baixa e prateleiras que contam a história do clube.",
    },
    {
      id: "trophyroom.line.002",
      who: "president",
      text: "Cada taça aqui tem um nome por trás. Escreva o seu.",
    },
    { id: "trophyroom.line.003", who: "manager", text: "Vou encher uma prateleira inteira." },
  ]),
  staffroom: scene("staffroom", "Sala da comissão técnica", "staff", [
    {
      id: "staffroom.line.001",
      who: "assistant",
      text: "O quadro está pronto. Rival marca por pressão no lado direito.",
    },
    {
      id: "staffroom.line.002",
      who: "doctor",
      text: "Elenco fisicamente bem, dois no limite de cartões.",
    },
    {
      id: "staffroom.line.003",
      who: "scout",
      text: "Tenho três nomes baratos que resolvem o meio-campo.",
    },
    { id: "staffroom.line.004", who: "manager", text: "Traga o relatório. Decidimos até sexta." },
  ]),
  board: scene("board", "Reunião com a diretoria", "board", [
    {
      id: "board.line.001",
      who: "president",
      text: "Os números precisam fechar. E a torcida precisa sorrir.",
    },
    { id: "board.line.002", who: "manager", text: "Me dê a janela e eu entrego as duas coisas." },
    { id: "board.line.003", who: "president", text: "Está anotado. Vamos cobrar." },
  ]),
  transferwindow: scene("transferwindow", "Janela de transferências", "transfer", [
    {
      id: "transferwindow.line.001",
      who: "agent",
      text: "Meu jogador gosta do projeto. O salário é que precisa conversar.",
    },
    {
      id: "transferwindow.line.002",
      who: "manager",
      text: "Nós pagamos por rendimento, não por currículo.",
    },
    {
      id: "transferwindow.line.003",
      who: "scout",
      text: "Se ele recusar, tenho um garoto que faz o mesmo por metade.",
    },
  ]),

  /* ------------------------------------------------ momentos de temporada */
  winstreak: scene(
    "winstreak",
    "Sequência de vitórias",
    "celebration",
    [
      {
        id: "winstreak.line.001",
        who: "narrator",
        text: "Três, quatro, cinco jogos. A cidade só fala do time.",
      },
      {
        id: "winstreak.line.002",
        who: "press",
        text: "É o melhor momento do clube em anos. Qual o segredo?",
      },
      {
        id: "winstreak.line.003",
        who: "manager",
        text: "Trabalho chato e repetido, todo dia, sem holofote.",
      },
    ],
    "good",
  ),
  comeback: scene(
    "comeback",
    "Virada histórica",
    "celebration",
    [
      {
        id: "comeback.line.001",
        who: "narrator",
        text: "Estava perdido. Terminou em festa nos últimos minutos.",
      },
      { id: "comeback.line.002", who: "captain", text: "Ninguém acreditou em nós, professor." },
      { id: "comeback.line.003", who: "manager", text: "Nós acreditamos. É o que importa." },
    ],
    "good",
  ),
  badloss: scene(
    "badloss",
    "Derrota dolorosa",
    "defeat",
    [
      {
        id: "badloss.line.001",
        who: "narrator",
        text: "Vestiário em silêncio. Só o barulho do chuveiro ao fundo.",
      },
      {
        id: "badloss.line.002",
        who: "manager",
        text: "A culpa é minha. A resposta é de todos nós, na próxima.",
      },
      { id: "badloss.line.003", who: "captain", text: "Vamos dar essa resposta." },
    ],
    "bad",
  ),
  sackrisk: scene(
    "sackrisk",
    "Reunião de emergência",
    "board",
    [
      {
        id: "sackrisk.line.001",
        who: "president",
        text: "Não posso segurar a pressão por muito mais tempo.",
      },
      {
        id: "sackrisk.line.002",
        who: "manager",
        text: "Me dê três jogos. Você vai ver outro time.",
      },
      { id: "sackrisk.line.003", who: "president", text: "Três. Nem um a mais." },
    ],
    "bad",
  ),
  promotion: scene(
    "promotion",
    "Acesso conquistado",
    "celebration",
    [
      {
        id: "promotion.line.001",
        who: "narrator",
        text: "Invasão de campo, bandeirões e o apito final mais longo do ano.",
      },
      { id: "promotion.line.002", who: "fan", text: "Subimos! Subimos!" },
      {
        id: "promotion.line.003",
        who: "manager",
        text: "Agora começa a parte difícil: se manter lá em cima.",
      },
    ],
    "good",
  ),
  farewell: scene(
    "farewell",
    "Despedida",
    "farewell",
    [
      {
        id: "farewell.line.001",
        who: "narrator",
        text: "Malas no corredor. O escudo fica; o treinador segue.",
      },
      {
        id: "farewell.line.002",
        who: "manager",
        text: "Obrigado por tudo. Este clube me ensinou mais do que eu ensinei.",
      },
      { id: "farewell.line.003", who: "fan", text: "Volte sempre, professor." },
    ],
    "bad",
  ),
  "cup-draw": scene("cup-draw", "Sorteio da copa", "board", [
    {
      id: "cup-draw.line.001",
      who: "narrator",
      text: "Bolinhas giram no globo de vidro. A sala inteira prende a respiração.",
    },
    {
      id: "cup-draw.line.002",
      who: "press",
      text: "E o adversário do seu time na próxima fase é...",
    },
    {
      id: "cup-draw.line.003",
      who: "manager",
      text: "Seja quem for, a gente estuda e enfrenta. Copa é jogo de detalhe.",
    },
    {
      id: "cup-draw.line.004",
      who: "assistant",
      text: "Já peço os vídeos dos últimos cinco jogos deles.",
    },
  ]),
  "press-defeat": scene(
    "press-defeat",
    "Coletiva após a derrota",
    "press",
    [
      {
        id: "press-defeat.line.001",
        who: "narrator",
        text: "Sala apertada, microfones ligados, ninguém sorrindo.",
      },
      {
        id: "press-defeat.line.002",
        who: "press",
        text: "O time não criou nada. O senhor errou a escalação?",
      },
      {
        id: "press-defeat.line.003",
        who: "manager",
        text: "A responsabilidade é minha. Amanhã cedo estamos no campo corrigindo.",
      },
      { id: "press-defeat.line.004", who: "press", text: "A diretoria te garantiu no cargo?" },
      {
        id: "press-defeat.line.005",
        who: "manager",
        text: "Meu emprego se garante ganhando. É o que pretendo fazer.",
      },
    ],
    "bad",
  ),
  renewal: scene(
    "renewal",
    "Renovação de contrato",
    "board",
    [
      {
        id: "renewal.line.001",
        who: "president",
        text: "O conselho aprovou por unanimidade. Queremos você por mais tempo.",
      },
      {
        id: "renewal.line.002",
        who: "manager",
        text: "Aceito — mas quero decidir as contratações da próxima janela.",
      },
      { id: "renewal.line.003", who: "president", text: "Fechado. Assine aqui e vamos brindar." },
      {
        id: "renewal.line.004",
        who: "narrator",
        text: "Flashes, aperto de mão e uma caneta que vale uma temporada inteira.",
      },
    ],
    "good",
  ),
  "idol-farewell": scene(
    "idol-farewell",
    "Despedida do ídolo",
    "farewell",
    [
      {
        id: "idol-farewell.line.001",
        who: "narrator",
        text: "Estádio cheio num amistoso de terça. Todos vieram por um homem só.",
      },
      {
        id: "idol-farewell.line.002",
        who: "captain",
        text: "Foram doze anos. Vou sentir falta do cheiro da grama molhada.",
      },
      { id: "idol-farewell.line.003", who: "fan", text: "Eterno! Eterno!" },
      {
        id: "idol-farewell.line.004",
        who: "manager",
        text: "A camisa sai de campo, mas a régua que ele deixou fica no vestiário.",
      },
    ],
    "good",
  ),
  "title-night": scene(
    "title-night",
    "Noite de título",
    "trophy",
    [
      {
        id: "title-night.line.001",
        who: "narrator",
        text: "Papel picado no ar, o gramado some debaixo da festa.",
      },
      {
        id: "title-night.line.002",
        who: "captain",
        text: "Professor, essa taça é sua também. Sobe aí com a gente.",
      },
      {
        id: "title-night.line.003",
        who: "manager",
        text: "É de todo mundo. Do roupeiro ao torcedor que veio na chuva.",
      },
      { id: "title-night.line.004", who: "fan", text: "Campeão! Campeão!" },
      {
        id: "title-night.line.005",
        who: "narrator",
        text: "A taça sobe. A cidade não dorme hoje.",
      },
    ],
    "good",
  ),
  "derby-week": scene("derby-week", "Semana de clássico", "dressing", [
    {
      id: "derby-week.line.001",
      who: "narrator",
      text: "A cidade amanheceu dividida. Bandeiras nas janelas, faixas nos postes.",
    },
    { id: "derby-week.line.002", who: "captain", text: "Professor, esse aqui vale por três." },
    {
      id: "derby-week.line.003",
      who: "manager",
      text: "Vale por um. Mas jogamos como se valesse a temporada inteira.",
    },
    {
      id: "derby-week.line.004",
      who: "assistant",
      text: "Marcação individual nas bolas paradas. Eles vivem disso.",
    },
  ]),
  "youth-debut": scene(
    "youth-debut",
    "Estreia do garoto da base",
    "tunnel",
    [
      {
        id: "youth-debut.line.001",
        who: "scout",
        text: "Ele treina com o profissional desde os quinze. Está pronto.",
      },
      {
        id: "youth-debut.line.002",
        who: "manager",
        text: "Garoto, joga do teu jeito. Se errar, o erro é meu.",
      },
      {
        id: "youth-debut.line.003",
        who: "narrator",
        text: "O número dele aparece na quarta placa. O estádio levanta.",
      },
    ],
    "good",
  ),
  /* ------------------------------------------------ antes do apito */
  "prematch-locker": scene("prematch-locker", "Vestiário", "dressing", [
    {
      id: "prematch-locker.line.001",
      who: "narrator",
      text: "Cheiro de cânfora, rádio baixinho e o quadro tático ainda molhado.",
    },
    {
      id: "prematch-locker.line.002",
      who: "assistant",
      text: "Escalação no quadro, professor. Todos liberados pelo departamento.",
    },
    {
      id: "prematch-locker.line.003",
      who: "manager",
      text: "Primeiros quinze minutos intensos. Depois a gente controla o jogo.",
    },
    {
      id: "prematch-locker.line.004",
      who: "captain",
      text: "O grupo entendeu. Ninguém sai de campo com dúvida hoje.",
    },
  ]),
  "prematch-kit": scene("prematch-kit", "Vestindo a camisa", "kitroom", [
    {
      id: "prematch-kit.line.001",
      who: "narrator",
      text: "Camisas numeradas penduradas em fila, cada uma no seu gancho.",
    },
    {
      id: "prematch-kit.line.002",
      who: "captain",
      text: "Essa camisa pesa. Hoje ela pesa a nosso favor.",
    },
    {
      id: "prematch-kit.line.003",
      who: "manager",
      text: "Veste com respeito. Tem gente na arquibancada que juntou a semana pra estar aqui.",
    },
    {
      id: "prematch-kit.line.004",
      who: "narrator",
      text: "Chuteiras amarradas, caneleiras no lugar, o último abraço no roupeiro.",
    },
  ]),
  "prematch-tunnel": scene("prematch-tunnel", "Túnel de acesso", "tunnel", [
    {
      id: "prematch-tunnel.line.001",
      who: "narrator",
      text: "Fila formada no escuro. Lá na frente, a boca do túnel em luz branca.",
    },
    {
      id: "prematch-tunnel.line.002",
      who: "captain",
      text: "Mão na mão. Ninguém anda sozinho aqui.",
    },
    {
      id: "prematch-tunnel.line.003",
      who: "manager",
      text: "Cabeça erguida. O jogo começa no primeiro passo.",
    },
    { id: "prematch-tunnel.line.004", who: "fan", text: "Vamos, vamos, o time não pode parar!" },
  ]),
  "prematch-whistle": scene("prematch-whistle", "O apito inicial", "pitchentry", [
    {
      id: "prematch-whistle.line.001",
      who: "narrator",
      text: "O gramado abre em verde sob os refletores. Setenta mil de pé.",
    },
    {
      id: "prematch-whistle.line.002",
      who: "commentator",
      text: "Moeda no ar, aperto de mãos, bola no círculo central. Está tudo pronto para uma grande partida.",
    },
    { id: "prematch-whistle.line.003", who: "manager", text: "Agora é com vocês." },
    {
      id: "prematch-whistle.line.004",
      who: "referee",
      text: "Capitães avisados. Ao meu apito... valendo!",
    },
  ]),
  "postmatch-tunnel": scene("postmatch-tunnel", "De volta ao túnel", "tunnel", [
    {
      id: "postmatch-tunnel.line.001",
      who: "narrator",
      text: "As luzes do campo ficam para trás. No túnel, cada chuteira devolve o eco dos noventa minutos.",
    },
    {
      id: "postmatch-tunnel.line.002",
      who: "captain",
      text: "Respira, professor. O grupo vai junto até o fim.",
    },
    {
      id: "postmatch-tunnel.line.003",
      who: "manager",
      text: "Cabeça erguida. O resultado termina aqui; o trabalho continua agora.",
    },
  ]),
  "postmatch-locker": scene("postmatch-locker", "A porta do vestiário", "dressing", [
    {
      id: "postmatch-locker.line.001",
      who: "narrator",
      text: "A porta fecha, o barulho da arquibancada vira um rumor distante e o placar ainda pesa no silêncio.",
    },
    {
      id: "postmatch-locker.line.002",
      who: "assistant",
      text: "Os dados já chegaram. Há respostas no vídeo e no próximo treino.",
    },
    {
      id: "postmatch-locker.line.003",
      who: "manager",
      text: "Guardem a emoção. Amanhã transformamos cada lance em decisão melhor.",
    },
  ]),
  "postmatch-press": scene("postmatch-press", "Coletiva pós-jogo", "press", [
    {
      id: "postmatch-press.line.001",
      who: "narrator",
      text: "Luzes acesas, gravadores na mesa e dezenas de perguntas esperando uma frase.",
    },
    {
      id: "postmatch-press.line.002",
      who: "press",
      text: "Qual é a leitura do resultado e o que muda para a próxima partida?",
    },
    {
      id: "postmatch-press.line.003",
      who: "manager",
      text: "Assumo as decisões. Vamos analisar sem desculpas e voltar mais fortes.",
    },
    {
      id: "postmatch-press.line.004",
      who: "narrator",
      text: "O último flash dispara. A noite termina, mas a temporada segue aberta.",
    },
  ]),

  "injury-blow": scene(
    "injury-blow",
    "Lesão do craque",
    "medical",
    [
      {
        id: "injury-blow.line.001",
        who: "doctor",
        text: "Exame confirmou. Fora por seis semanas, no melhor cenário.",
      },
      {
        id: "injury-blow.line.002",
        who: "manager",
        text: "Ninguém substitui ele sozinho. Vamos substituir em quatro.",
      },
      {
        id: "injury-blow.line.003",
        who: "captain",
        text: "O grupo cobre. Diga só como você quer.",
      },
    ],
    "bad",
  ),

  /* ------------------------------------------------ novas cenas de jornada */
  "bus-arrival": scene("bus-arrival", "Chegada do ônibus", "arrival", [
    {
      id: "bus-arrival.line.001",
      who: "narrator",
      text: "Sinalizadores vermelhos cercam o ônibus a dois quarteirões do estádio.",
    },
    { id: "bus-arrival.line.002", who: "captain", text: "Olha o tamanho disso, professor." },
    {
      id: "bus-arrival.line.003",
      who: "manager",
      text: "É por isso que a gente treina. Aproveita cada metro desse corredor.",
    },
  ]),
  "warmup-pitch": scene("warmup-pitch", "Aquecimento no gramado", "training", [
    {
      id: "warmup-pitch.line.001",
      who: "assistant",
      text: "Gramado firme, bola corre. Chuteira de trava curta serve.",
    },
    {
      id: "warmup-pitch.line.002",
      who: "manager",
      text: "Avisa a linha de trás: bola rápida exige linha mais compacta.",
    },
  ]),
  "team-talk": scene("team-talk", "Preleção final", "dressing", [
    {
      id: "team-talk.line.001",
      who: "manager",
      text: "Três coisas: pressão alta, bola pro lado forte, ninguém reclama do árbitro.",
    },
    {
      id: "team-talk.line.002",
      who: "captain",
      text: "Entendido. A gente resolve dentro de campo.",
    },
  ]),
  "coin-toss": scene("coin-toss", "Sorteio no círculo", "pitchentry", [
    {
      id: "coin-toss.line.001",
      who: "narrator",
      text: "Capitães frente a frente. A moeda sobe e brilha sob o refletor.",
    },
    {
      id: "coin-toss.line.002",
      who: "captain",
      text: "Escolhemos o campo. O vento vem do nosso lado no segundo tempo.",
    },
  ]),
  anthem: scene("anthem", "Hino no gramado", "pitchentry", [
    {
      id: "anthem.line.001",
      who: "narrator",
      text: "Bandeirão cobre a arquibancada inteira, de trave a trave.",
    },
    { id: "anthem.line.002", who: "fan", text: "Canta, canta, essa camisa é nossa vida!" },
    {
      id: "anthem.line.003",
      who: "manager",
      text: "Se o time jogar com metade disso, ninguém segura.",
    },
  ]),
  "crowd-entry": scene("crowd-entry", "Entrada da torcida", "pitchentry", [
    {
      id: "crowd-entry.line.001",
      who: "narrator",
      text: "Portões abrem e a arquibancada enche em ondas de cor.",
    },
    {
      id: "crowd-entry.line.002",
      who: "fan",
      text: "Chegamos cedo porque hoje não dá pra perder nada.",
    },
  ]),
  "goal-roar": scene(
    "goal-roar",
    "O gol que explodiu o estádio",
    "celebration",
    [
      {
        id: "goal-roar.line.001",
        who: "commentator",
        text: "A bola entra no ângulo! Que finalização espetacular — o estádio inteiro sai do chão!",
      },
      { id: "goal-roar.line.002", who: "fan", text: "Gooool! Gooool!" },
      {
        id: "goal-roar.line.003",
        who: "manager",
        text: "Comemora rápido e volta pra posição. O jogo não acabou.",
      },
    ],
    "good",
  ),
  "penalty-decisive": scene(
    "penalty-decisive",
    "Pênalti decisivo",
    "pitchentry",
    [
      {
        id: "penalty-decisive.line.001",
        who: "narrator",
        text: "Bola na marca da cal, goleiro dançando na linha.",
      },
      { id: "penalty-decisive.line.002", who: "captain", text: "Deixa comigo, professor." },
      {
        id: "penalty-decisive.line.003",
        who: "narrator",
        text: "Silêncio absoluto por dois segundos. Depois, o barulho.",
      },
    ],
    "good",
  ),
  "red-card": scene(
    "red-card",
    "Cartão vermelho",
    "tactics",
    [
      {
        id: "red-card.line.001",
        who: "narrator",
        text: "O árbitro leva a mão ao bolso e o estádio protesta em coro.",
      },
      {
        id: "red-card.line.002",
        who: "manager",
        text: "Um a menos: fecha o meio, joga com a linha baixa e contra-ataque.",
      },
      {
        id: "red-card.line.003",
        who: "captain",
        text: "Ninguém entra em desespero. Um passe de cada vez.",
      },
    ],
    "bad",
  ),
  substitution: scene("substitution", "A troca que muda o jogo", "tactics", [
    {
      id: "substitution.line.001",
      who: "assistant",
      text: "Ele está a mil. Entrando agora, pega a zaga cansada.",
    },
    {
      id: "substitution.line.002",
      who: "manager",
      text: "Entra pelo lado, encara o marcador e não pensa duas vezes.",
    },
  ]),
  "halftime-fix": scene("halftime-fix", "Intervalo", "dressing", [
    {
      id: "halftime-fix.line.001",
      who: "manager",
      text: "Perdemos o meio-campo. Um volante recua, o lateral sobe por dentro.",
    },
    {
      id: "halftime-fix.line.002",
      who: "captain",
      text: "Melhor assim. Estávamos correndo atrás da sombra deles.",
    },
  ]),
  "press-after-win": scene(
    "press-after-win",
    "Coletiva após a vitória",
    "press",
    [
      { id: "press-after-win.line.001", who: "press", text: "Foi a melhor atuação do ano?" },
      {
        id: "press-after-win.line.002",
        who: "manager",
        text: "Foi a mais madura. Melhor não existe enquanto a temporada corre.",
      },
    ],
    "good",
  ),
  "press-after-loss": scene(
    "press-after-loss",
    "Coletiva após a derrota",
    "press",
    [
      { id: "press-after-loss.line.001", who: "press", text: "O senhor sente o cargo ameaçado?" },
      {
        id: "press-after-loss.line.002",
        who: "manager",
        text: "Sinto responsabilidade. A resposta é no treino de segunda.",
      },
    ],
    "bad",
  ),
  "trophy-lift": scene(
    "trophy-lift",
    "A taça erguida",
    "trophy",
    [
      {
        id: "trophy-lift.line.001",
        who: "narrator",
        text: "Papel picado, palco montado e a taça pesando nas mãos do capitão.",
      },
      {
        id: "trophy-lift.line.002",
        who: "captain",
        text: "Isso aqui é de quem acordou cedo o ano inteiro.",
      },
    ],
    "good",
  ),
  "promotion-night": scene(
    "promotion-night",
    "Noite do acesso",
    "celebration",
    [
      {
        id: "promotion-night.line.001",
        who: "narrator",
        text: "Apito final e a cidade inteira parece ter entrado em campo.",
      },
      {
        id: "promotion-night.line.002",
        who: "president",
        text: "Subimos de divisão. Agora vem o difícil: ficar lá.",
      },
    ],
    "good",
  ),
  "relegation-night": scene(
    "relegation-night",
    "Noite do rebaixamento",
    "defeat",
    [
      {
        id: "relegation-night.line.001",
        who: "narrator",
        text: "Arquibancada vazia antes do apito. Silêncio pesado no gramado.",
      },
      {
        id: "relegation-night.line.002",
        who: "manager",
        text: "A culpa é minha. A reconstrução começa amanhã de manhã.",
      },
    ],
    "bad",
  ),
  "derby-week-buildup": scene("derby-week-buildup", "Véspera de clássico", "tactics", [
    {
      id: "derby-week-buildup.line.001",
      who: "press",
      text: "Clássico se ganha no detalhe ou na raça?",
    },
    {
      id: "derby-week-buildup.line.002",
      who: "manager",
      text: "Nos dois. Detalhe pra criar, raça pra não devolver o que é nosso.",
    },
  ]),
  "scout-report": scene("scout-report", "Relatório do olheiro", "staff", [
    {
      id: "scout-report.line.001",
      who: "scout",
      text: "Garoto de 19 anos, canhoto, joga por dentro e por fora.",
    },
    {
      id: "scout-report.line.002",
      who: "manager",
      text: "Traz ele pra treinar com o grupo antes de qualquer proposta.",
    },
  ]),
  "agent-offer": scene("agent-offer", "Proposta do empresário", "transfer", [
    {
      id: "agent-offer.line.001",
      who: "agent",
      text: "Tenho uma oferta alta por ele. O jogador já sabe.",
    },
    {
      id: "agent-offer.line.002",
      who: "manager",
      text: "Se sair, sai pelo valor certo e com substituto assinado.",
    },
  ]),
  "board-review": scene("board-review", "Reunião de diretoria", "board", [
    {
      id: "board-review.line.001",
      who: "president",
      text: "Folha salarial no limite. Precisamos vender ou cortar.",
    },
    {
      id: "board-review.line.002",
      who: "manager",
      text: "Vendo um, promovo dois da base. Economia e identidade juntas.",
    },
  ]),
  "youth-debut-night": scene(
    "youth-debut-night",
    "Estreia do garoto da base",
    "pitchentry",
    [
      {
        id: "youth-debut-night.line.001",
        who: "assistant",
        text: "Ele chorou no vestiário quando viu a camisa com o nome dele.",
      },
      {
        id: "youth-debut-night.line.002",
        who: "manager",
        text: "Entra tranquilo. Erra pra frente que ninguém vai te cobrar.",
      },
    ],
    "good",
  ),
  "medical-room": scene(
    "medical-room",
    "Departamento médico",
    "medical",
    [
      {
        id: "medical-room.line.001",
        who: "doctor",
        text: "Três atletas na fisioterapia. Dois voltam na semana que vem.",
      },
      {
        id: "medical-room.line.002",
        who: "manager",
        text: "Nada de pressa. Recaída custa o dobro de jogos.",
      },
    ],
    "bad",
  ),
  "fan-meeting": scene("fan-meeting", "Encontro com a torcida", "arrival", [
    {
      id: "fan-meeting.line.001",
      who: "fan",
      text: "A gente só quer ver o time correr, professor.",
    },
    {
      id: "fan-meeting.line.002",
      who: "manager",
      text: "Correr é o mínimo. Prometo time organizado também.",
    },
  ]),
  "contract-renewal": scene(
    "contract-renewal",
    "Renovação do capitão",
    "board",
    [
      {
        id: "contract-renewal.line.001",
        who: "captain",
        text: "Quero terminar a carreira aqui, mas preciso me sentir importante.",
      },
      {
        id: "contract-renewal.line.002",
        who: "manager",
        text: "Você é a espinha do time. A diretoria já tem minha recomendação.",
      },
    ],
    "good",
  ),
  "season-farewell": scene("season-farewell", "Último jogo da temporada", "farewell", [
    {
      id: "season-farewell.line.001",
      who: "narrator",
      text: "Volta olímpica lenta, crianças no gramado, câmeras ao fundo.",
    },
    {
      id: "season-farewell.line.002",
      who: "manager",
      text: "Guarda essa imagem. Ela é o combustível da pré-temporada.",
    },
  ]),

  /* --------------------------------- arco de história (sorteio contextual) */
  "season-kickoff": scene("season-kickoff", "Abertura da temporada", "arrival", [
    {
      id: "season-kickoff.line.001",
      who: "narrator",
      text: "Primeira segunda de temporada. Tabela nova colada na parede do vestiário.",
    },
    {
      id: "season-kickoff.line.002",
      who: "president",
      text: "O orçamento está aprovado, o elenco é esse. A meta é uma só: brigar lá em cima.",
    },
    {
      id: "season-kickoff.line.003",
      who: "manager",
      text: "Meu grupo vai correr por cada ponto. Começa hoje, sem desculpa.",
    },
    {
      id: "season-kickoff.line.004",
      who: "captain",
      text: "Professor, o elenco está com você. A gente entra junto e sai junto.",
    },
    {
      id: "season-kickoff.line.005",
      who: "narrator",
      text: "O apito da primeira rodada ainda nem soou — e a cidade já sonha.",
    },
  ]),
  "crisis-meeting": scene(
    "crisis-meeting",
    "Sequência sem vencer",
    "board",
    [
      {
        id: "crisis-meeting.line.001",
        who: "narrator",
        text: "Quatro jogos sem vitória. O corredor da diretoria anda mais silencioso que o normal.",
      },
      {
        id: "crisis-meeting.line.002",
        who: "president",
        text: "A torcida está inquieta e eu também. O que está acontecendo lá dentro?",
      },
      {
        id: "crisis-meeting.line.003",
        who: "manager",
        text: "O modelo está certo, a execução oscila. Peço paciência e um ajuste no elenco.",
      },
      {
        id: "crisis-meeting.line.004",
        who: "president",
        text: "Paciência custa pontos. Me mostra reação nos próximos dois jogos.",
      },
      {
        id: "crisis-meeting.line.005",
        who: "narrator",
        text: "O telefone do presidente não para. A próxima rodada decide o clima.",
      },
    ],
    "bad",
  ),
  ultimatum: scene(
    "ultimatum",
    "O ultimato",
    "board",
    [
      {
        id: "ultimatum.line.001",
        who: "narrator",
        text: "Reunião marcada às pressas. Na mesa, só água e uma planilha de resultados.",
      },
      {
        id: "ultimatum.line.002",
        who: "president",
        text: "Não vou fingir: seu cargo está em risco. Três jogos. É o que consigo segurar.",
      },
      {
        id: "ultimatum.line.003",
        who: "manager",
        text: "Três jogos bastam. Vou te devolver um time que convence, não só que vence.",
      },
      {
        id: "ultimatum.line.004",
        who: "president",
        text: "Quero vencer. O resto a gente discute depois.",
      },
      {
        id: "ultimatum.line.005",
        who: "narrator",
        text: "Saindo da sala, uma certeza: derrota agora custa o emprego.",
      },
    ],
    "bad",
  ),
  "captain-split": scene(
    "captain-split",
    "Racha no vestiário",
    "dressing",
    [
      {
        id: "captain-split.line.001",
        who: "narrator",
        text: "O treino termina cedo. O capitão pede a palavra — e não é para falar de tática.",
      },
      {
        id: "captain-split.line.002",
        who: "captain",
        text: "Com todo respeito, professor: o grupo não aguenta mais treinar uma coisa e jogar outra.",
      },
      {
        id: "captain-split.line.003",
        who: "manager",
        text: "Fala na minha cara, então. O que você quer que mude?",
      },
      {
        id: "captain-split.line.004",
        who: "captain",
        text: "Menos rodízio, mais cobrança de quem erra. Hierarquia se conquista, mas se mantém.",
      },
      {
        id: "captain-split.line.005",
        who: "assistant",
        text: "Ele fala por metade. A outra metade acha que ele exagera. Você decide.",
      },
    ],
    "bad",
  ),
  "dressing-unity": scene(
    "dressing-unity",
    "O grupo se fecha",
    "dressing",
    [
      {
        id: "dressing-unity.line.001",
        who: "narrator",
        text: "Porta trancada, celulares fora. Só o grupo, uma bola e a verdade.",
      },
      {
        id: "dressing-unity.line.002",
        who: "captain",
        text: "Daqui pra frente, erro meu é erro nosso. Ninguém joga sozinho.",
      },
      {
        id: "dressing-unity.line.003",
        who: "manager",
        text: "Se é pra cair, cai junto. Se é pra subir, sobe junto. Fechado?",
      },
      {
        id: "dressing-unity.line.004",
        who: "fan",
        text: "De fora dá pra ouvir: um grito só, quarenta vozes ao mesmo tempo.",
      },
      {
        id: "dressing-unity.line.005",
        who: "narrator",
        text: "Times assim não precisam de discurso. Precisam de resultado.",
      },
    ],
    "good",
  ),
  "mind-games": scene("mind-games", "Guerra de palavras", "press", [
    {
      id: "mind-games.line.001",
      who: "press",
      text: "O técnico rival disse que seu time só sabe se defender. Como responde?",
    },
    {
      id: "mind-games.line.002",
      who: "manager",
      text: "Eu respondo sábado, em campo, com a bola rolando. Provocação não marca gol.",
    },
    { id: "mind-games.line.003", who: "press", text: "Mas a torcida quer uma resposta agora..." },
    {
      id: "mind-games.line.004",
      who: "manager",
      text: "A torcida quer vitória. E é isso que vou dar.",
    },
    {
      id: "mind-games.line.005",
      who: "narrator",
      text: "A manchete sai mesmo assim. O clássico ganha mais um capítulo.",
    },
  ]),
  "captain-injury": scene(
    "captain-injury",
    "O capitão cai",
    "medical",
    [
      {
        id: "captain-injury.line.001",
        who: "narrator",
        text: "Ele torce o joelho sozinho, sem contato. O estádio inteiro percebe na hora.",
      },
      {
        id: "captain-injury.line.002",
        who: "doctor",
        text: "Não é o pior cenário, mas são oito semanas fora. No mínimo.",
      },
      {
        id: "captain-injury.line.003",
        who: "manager",
        text: "A braçadeira passa pro vice. E o grupo joga por ele até voltar.",
      },
      {
        id: "captain-injury.line.004",
        who: "captain",
        text: "Promete uma coisa, professor: quando eu voltar, esse time está melhor.",
      },
    ],
    "bad",
  ),
  "academy-gem": scene(
    "academy-gem",
    "Joia da base",
    "staff",
    [
      {
        id: "academy-gem.line.001",
        who: "scout",
        text: "Dezesseis anos, dois pés bons e cabeça de veterano. Nunca vi nada igual.",
      },
      {
        id: "academy-gem.line.002",
        who: "assistant",
        text: "Tem corpo pra profissional? Ou vamos queimar o garoto?",
      },
      {
        id: "academy-gem.line.003",
        who: "manager",
        text: "Minutos controlados, proteção da comissão e paciência. Joia não se apressa.",
      },
      {
        id: "academy-gem.line.004",
        who: "narrator",
        text: "Na saída, o garoto olha o gramado principal como quem vê o futuro.",
      },
    ],
    "good",
  ),
  "transfer-saga": scene(
    "transfer-saga",
    "A novela da janela",
    "transfer",
    [
      {
        id: "transfer-saga.line.001",
        who: "agent",
        text: "O clube grande voltou com oferta maior. Meu jogador quer ouvir. Hoje.",
      },
      {
        id: "transfer-saga.line.002",
        who: "manager",
        text: "Ofertas chegam na diretoria. Quem decide se o time precisa dele sou eu.",
      },
      {
        id: "transfer-saga.line.003",
        who: "president",
        text: "O valor é tentador, mas cair de rendimento custa mais que qualquer venda.",
      },
      {
        id: "transfer-saga.line.004",
        who: "manager",
        text: "Segurem ele até dezembro. Depois, se for bom pros dois lados, a gente conversa.",
      },
      {
        id: "transfer-saga.line.005",
        who: "narrator",
        text: "A janela fecha em dias. O telefone não para de tocar.",
      },
    ],
    "neutral",
  ),
  "deadline-day": scene("deadline-day", "Último dia da janela", "transfer", [
    {
      id: "deadline-day.line.001",
      who: "narrator",
      text: "Relógio na parede, contratos espalhados e três telefones tocando juntos.",
    },
    {
      id: "deadline-day.line.002",
      who: "agent",
      text: "Faltam duas horas. Assina agora ou ele vai pro rival.",
    },
    {
      id: "deadline-day.line.003",
      who: "manager",
      text: "Anda, presidente. Quem contrata em pânico contrata errado — mas não contratar é pior.",
    },
    {
      id: "deadline-day.line.004",
      who: "president",
      text: "Fechado. O fax já saiu. Agora é com ele.",
    },
    {
      id: "deadline-day.line.005",
      who: "narrator",
      text: "Janela fechada. O elenco que você tem é o elenco que te leva até o fim.",
    },
  ]),
  "cup-final-eve": scene("cup-final-eve", "Véspera de decisão", "dressing", [
    {
      id: "cup-final-eve.line.001",
      who: "narrator",
      text: "Hotel silencioso, luzes apagadas cedo. Amanhã é o jogo do ano.",
    },
    {
      id: "cup-final-eve.line.002",
      who: "captain",
      text: "Ninguém aqui chegou até aqui por acaso, professor.",
    },
    {
      id: "cup-final-eve.line.003",
      who: "manager",
      text: "Durmam. Decisão se ganha descansado, não nervoso.",
    },
    {
      id: "cup-final-eve.line.004",
      who: "narrator",
      text: "O capitão fica mais dez minutos olhando a taça na propaganda da TV.",
    },
  ]),
  "relegation-fight": scene(
    "relegation-fight",
    "Luta contra a queda",
    "tactics",
    [
      {
        id: "relegation-fight.line.001",
        who: "narrator",
        text: "A tabela mostra o time na zona. O quadro tático, a saída.",
      },
      {
        id: "relegation-fight.line.002",
        who: "assistant",
        text: "Seis pontos em disputa. Precisamos de quatro. Os dois próximos são em casa.",
      },
      {
        id: "relegation-fight.line.003",
        who: "manager",
        text: "Em casa a gente ataca, fora a gente morde. Cada ponto é uma final.",
      },
      { id: "relegation-fight.line.004", who: "captain", text: "Pode contar. Esse grupo não cai." },
    ],
    "bad",
  ),
  "sacking-night": scene(
    "sacking-night",
    "A demissão",
    "farewell",
    [
      {
        id: "sacking-night.line.001",
        who: "narrator",
        text: "Nota oficial no site, à meia-noite. Duas linhas e um agradecimento frio.",
      },
      {
        id: "sacking-night.line.002",
        who: "president",
        text: "A decisão está tomada. Nada pessoal — é futebol, é resultado.",
      },
      {
        id: "sacking-night.line.003",
        who: "manager",
        text: "Saio de cabeça erguida. Dei tudo que tinha, todos os dias.",
      },
      {
        id: "sacking-night.line.004",
        who: "fan",
        text: "Na porta do CT, um grupo pequeno aplaude. Poucos, mas sinceros.",
      },
      { id: "sacking-night.line.005", who: "narrator", text: "O ciclo termina. A carreira, não." },
    ],
    "bad",
  ),
  "job-interview": scene("job-interview", "Entrevista de emprego", "board", [
    { id: "job-interview.line.001", who: "president", text: "Por que você, e por que agora?" },
    {
      id: "job-interview.line.002",
      who: "manager",
      text: "Porque eu monto time que compete todo jogo. Me dê o elenco e a janela.",
    },
    {
      id: "job-interview.line.003",
      who: "president",
      text: "A torcida aqui é exigente. E a paciência, curta.",
    },
    {
      id: "job-interview.line.004",
      who: "manager",
      text: "Paciência se conquista com vitória. Vitória se conquista com trabalho.",
    },
  ]),
  "rebuild-day-one": scene(
    "rebuild-day-one",
    "Primeiro dia da reconstrução",
    "arrival",
    [
      {
        id: "rebuild-day-one.line.001",
        who: "narrator",
        text: "Outros portões, outro escudo, a mesma vontade.",
      },
      {
        id: "rebuild-day-one.line.002",
        who: "captain",
        text: "Bem-vindo, professor. O grupo precisava de alguém com a sua história.",
      },
      {
        id: "rebuild-day-one.line.003",
        who: "manager",
        text: "História eu deixo na porta. Aqui começa tudo do zero, com vocês.",
      },
      {
        id: "rebuild-day-one.line.004",
        who: "narrator",
        text: "O primeiro treino começa em uma hora. A nova era, agora.",
      },
    ],
    "good",
  ),
  "legend-retirement": scene(
    "legend-retirement",
    "Aposentadoria do ídolo",
    "farewell",
    [
      {
        id: "legend-retirement.line.001",
        who: "narrator",
        text: "Última volta no gramado, chuteiras na mão, camisa suada pela última vez.",
      },
      {
        id: "legend-retirement.line.002",
        who: "captain",
        text: "Vinte anos atrás eu entrei aqui garoto. Saio homem feito por este clube.",
      },
      {
        id: "legend-retirement.line.003",
        who: "fan",
        text: "O nome dele ecoa por dez minutos sem parar.",
      },
      {
        id: "legend-retirement.line.004",
        who: "manager",
        text: "Camisa aposentada? Não. Ela espera o próximo que merecê-la tanto quanto ele.",
      },
      {
        id: "legend-retirement.line.005",
        who: "narrator",
        text: "Lendas não se despedem. Viram estátua.",
      },
    ],
    "good",
  ),
  /* ---------------------------------- segundo arco: rotina de um time grande */
  "unbeatable-run": scene(
    "unbeatable-run",
    "Sequência imparável",
    "dressing",
    [
      {
        id: "unbeatable-run.line.001",
        who: "narrator",
        text: "Seis vitórias seguidas. O vestiário cheira a confiança — e a superstição.",
      },
      {
        id: "unbeatable-run.line.002",
        who: "captain",
        text: "Ninguém muda nada. Mesma música, mesma cadeira, mesma resenha.",
      },
      {
        id: "unbeatable-run.line.003",
        who: "manager",
        text: "Sequência não ganha título. Ganha quem trata a sétima como se fosse a primeira.",
      },
      {
        id: "unbeatable-run.line.004",
        who: "fan",
        text: "O mosaico de sábado já está pronto: SEIS E CONTANDO.",
      },
    ],
    "good",
  ),
  "captain-100": scene(
    "captain-100",
    "Cem jogos de capitão",
    "pitchentry",
    [
      {
        id: "captain-100.line.001",
        who: "narrator",
        text: "Cem vezes a braçadeira no braço. Cem vezes o primeiro a sair do túnel.",
      },
      {
        id: "captain-100.line.002",
        who: "captain",
        text: "Não conto jogos. Conto as vezes que este escudo me salvou.",
      },
      {
        id: "captain-100.line.003",
        who: "fan",
        text: "Cem! Cem! Cem! A placa prateada espera no centro do campo.",
      },
      {
        id: "captain-100.line.004",
        who: "manager",
        text: "Capitão não é quem grita mais alto. É quem os outros seguem no escuro.",
      },
    ],
    "good",
  ),
  "injury-crisis": scene(
    "injury-crisis",
    "Enfermaria lotada",
    "dressing",
    [
      {
        id: "injury-crisis.line.001",
        who: "doctor",
        text: "Três no estaleiro, dois no limite. O GPS está gritando há duas semanas.",
      },
      {
        id: "injury-crisis.line.002",
        who: "manager",
        text: "Então a gente roda. Prefiro poupar hoje a chorar em maio.",
      },
      {
        id: "injury-crisis.line.003",
        who: "assistant",
        text: "A base tem dois prontos. Hora de ver do que são feitos.",
      },
      {
        id: "injury-crisis.line.004",
        who: "narrator",
        text: "Crise para uns, porta aberta para outros. O futebol adora esse roteiro.",
      },
    ],
    "bad",
  ),
  "fan-fury": scene(
    "fan-fury",
    "Fúria da arquibancada",
    "celebration",
    [
      {
        id: "fan-fury.line.001",
        who: "narrator",
        text: "Lençóis brancos na curva. O jogo termina sob um coro que ninguém queria ouvir.",
      },
      {
        id: "fan-fury.line.002",
        who: "fan",
        text: "Vergonha! Vergonha! Esse time não sua a camisa!",
      },
      {
        id: "fan-fury.line.003",
        who: "president",
        text: "Eu ouço a torcida. E a torcida, desta vez, tem razão.",
      },
      {
        id: "fan-fury.line.004",
        who: "manager",
        text: "Vão me cobrar no treino, no jogo, na rua. Eu aceito a pressão. Quarta é decisão: ou a gente responde, ou o apito final vem para mim.",
      },
    ],
    "bad",
  ),
  "board-pleased": scene(
    "board-pleased",
    "Diretoria satisfeita",
    "board",
    [
      {
        id: "board-pleased.line.001",
        who: "president",
        text: "Os números mudaram de cor. O conselho voltou a sorrir nas reuniões.",
      },
      {
        id: "board-pleased.line.002",
        who: "manager",
        text: "Bom. Agora me deixe transformar sorriso em planejamento.",
      },
      {
        id: "board-pleased.line.003",
        who: "narrator",
        text: "Crédito no banco: a palavra mais valiosa do futebol depois de gol.",
      },
      {
        id: "board-pleased.line.004",
        who: "president",
        text: "Traga a lista de reforços. Desta vez, o cofre abre primeiro.",
      },
    ],
    "good",
  ),
  "empty-seats": scene(
    "empty-seats",
    "Cadeiras vazias",
    "celebration",
    [
      {
        id: "empty-seats.line.001",
        who: "narrator",
        text: "Quarenta por cento de ocupação. O ingresso caro calou a festa.",
      },
      {
        id: "empty-seats.line.002",
        who: "fan",
        text: "Amor ao clube eu tenho. O que eu não tenho é dinheiro sobrando.",
      },
      {
        id: "empty-seats.line.003",
        who: "president",
        text: "Receita é importante. Casa cheia é mais importante ainda.",
      },
      {
        id: "empty-seats.line.004",
        who: "manager",
        text: "Me dê arquibancada cheia que eu devolvo em ponto. Futebol é troca.",
      },
    ],
    "bad",
  ),

  /* ------------------------------------------------ escolhas (jogáveis) */
  "agent-demands": scene("agent-demands", "O empresário liga", "office", [
    {
      id: "agent-demands.line.001",
      who: "narrator",
      text: "Terça-feira, 8h. O empresário do seu craque quer renovação — e quer hoje.",
    },
    {
      id: "agent-demands.line.002",
      who: "agent",
      text: "Meu cliente tem proposta de fora. Ou melhora o salário, ou ele sai em janeiro.",
    },
    {
      id: "agent-demands.line.003",
      who: "manager",
      text: "Você segura o telefone e pensa. O que responde?",
      choices: [
        {
          id: "agent-demands.choice.01",
          label: "Prometer renovação",
          hint: "Moral do craque sobe, diretoria cobra a conta",
          response: [
            {
              id: "agent-demands.line.004",
              who: "manager",
              text: "Diz a ele que renovamos. Salário de estrela para quem decide jogo.",
            },
            {
              id: "agent-demands.line.005",
              who: "agent",
              text: "Palavra de treinador vale ouro. Vou segurar as outras propostas.",
            },
          ],
          effect: { morale: 6, approval: -4, headline: "Treinador promete renovação do craque" },
        },
        {
          id: "agent-demands.choice.02",
          label: "Peitar o empresário",
          hint: "Mostra autoridade, mas o jogador pode azedar",
          response: [
            {
              id: "agent-demands.line.006",
              who: "manager",
              text: "Contrato se cumpre jogando. Diz a ele que o campo resolve tudo.",
            },
            {
              id: "agent-demands.line.007",
              who: "agent",
              text: "Veremos no campo, então. E na janela também.",
            },
          ],
          effect: { morale: -5, approval: 4, headline: "Treinador peita empresário do craque" },
        },
      ],
    },
  ]),
  "unhappy-knock": scene("unhappy-knock", "Batida na porta", "dressing", [
    {
      id: "unhappy-knock.line.001",
      who: "narrator",
      text: "Depois do treino, o reserva mais caro do elenco bate na sua porta.",
    },
    {
      id: "unhappy-knock.line.002",
      who: "captain",
      text: "Professor, preciso jogar. Do jeito que está, peço para sair.",
    },
    {
      id: "unhappy-knock.line.003",
      who: "manager",
      text: "O olhar dele é sério. Como você conduz?",
      choices: [
        {
          id: "unhappy-knock.choice.01",
          label: "Garantir minutos",
          hint: "Ele rende mais — mas vai cobrar",
          response: [
            {
              id: "unhappy-knock.line.004",
              who: "manager",
              text: "Você vai jogar. Trabalha que a vaga aparece já no próximo jogo.",
            },
            {
              id: "unhappy-knock.line.005",
              who: "captain",
              text: "É tudo que eu precisava ouvir. Não vou desperdiçar.",
            },
          ],
          effect: { morale: 8, pressure: 3, headline: "Reserva ganha promessa de minutos" },
        },
        {
          id: "unhappy-knock.choice.02",
          label: "Bancar a hierarquia",
          hint: "Grupo entende, ele nem tanto",
          response: [
            {
              id: "unhappy-knock.line.006",
              who: "manager",
              text: "Aqui ninguém tem vaga cativa. Nem você, nem eu. Mostra no treino.",
            },
            { id: "unhappy-knock.line.007", who: "captain", text: "...Entendido, professor." },
          ],
          effect: { morale: -4, approval: 3, headline: "Treinador banca hierarquia no elenco" },
        },
      ],
    },
  ]),
  "derby-eve-talk": scene("derby-eve-talk", "Véspera de clássico", "dressing", [
    {
      id: "derby-eve-talk.line.001",
      who: "narrator",
      text: "Véspera de clássico. O vestiário ferve antes mesmo da preleção.",
    },
    {
      id: "derby-eve-talk.line.002",
      who: "captain",
      text: "A cidade parou por esse jogo. O que a gente fala pra eles, professor?",
    },
    {
      id: "derby-eve-talk.line.003",
      who: "manager",
      text: "Câmeras da TV do clube gravando. Escolha o tom:",
      choices: [
        {
          id: "derby-eve-talk.choice.01",
          label: "Provocar o rival",
          hint: "Torcida vai à loucura, pressão dobra",
          response: [
            {
              id: "derby-eve-talk.line.004",
              who: "manager",
              text: "Diz pra eles virem buscar. Na nossa casa, clássico tem dono.",
            },
            { id: "derby-eve-talk.line.005", who: "fan", text: "É ISSO! PRA CIMA DELES!" },
          ],
          effect: {
            fanApproval: 8,
            pressure: 6,
            morale: 3,
            headline: "Treinador provoca rival em clássico",
          },
        },
        {
          id: "derby-eve-talk.choice.02",
          label: "Pregar respeito",
          hint: "Seguro e profissional",
          response: [
            {
              id: "derby-eve-talk.line.006",
              who: "manager",
              text: "Respeito máximo, medo zero. Clássico se ganha no detalhe.",
            },
            {
              id: "derby-eve-talk.line.007",
              who: "captain",
              text: "No detalhe. Todo mundo ligado do primeiro ao último minuto.",
            },
          ],
          effect: {
            morale: 4,
            approval: 3,
            headline: "Treinador prega respeito antes do clássico",
          },
        },
      ],
    },
  ]),
  "doctor-gamble": scene("doctor-gamble", "O médico avisa", "medical", [
    {
      id: "doctor-gamble.line.001",
      who: "narrator",
      text: "O departamento médico chama você no corredor, cara fechada.",
    },
    {
      id: "doctor-gamble.line.002",
      who: "doctor",
      text: "O craque está a 70%. Se jogar, pode estourar. A decisão é sua.",
    },
    {
      id: "doctor-gamble.line.003",
      who: "manager",
      text: "Jogo grande amanhã. Você arrisca?",
      choices: [
        {
          id: "doctor-gamble.choice.01",
          label: "Poupar o craque",
          hint: "Seguro: ele volta 100%, time sente falta",
          response: [
            {
              id: "doctor-gamble.line.004",
              who: "manager",
              text: "Saúde primeiro. Ninguém ganha temporada em um jogo.",
            },
            {
              id: "doctor-gamble.line.005",
              who: "doctor",
              text: "Decisão correta. Em dez dias ele está voando.",
            },
          ],
          effect: { morale: 2, fanApproval: -3, headline: "Craque é poupado por precaução" },
        },
        {
          id: "doctor-gamble.choice.02",
          label: "Arriscar tudo",
          hint: "Ou herói, ou vilão",
          response: [
            {
              id: "doctor-gamble.line.006",
              who: "manager",
              text: "Infiltra, enfaixa e manda pra campo. Decisão se ganha com os melhores.",
            },
            {
              id: "doctor-gamble.line.007",
              who: "doctor",
              text: "Registrado: contra indicação médica. Boa sorte pra nós dois.",
            },
          ],
          effect: { morale: 5, pressure: 5, condition: -4, headline: "Craque joga no sacrifício" },
        },
      ],
    },
  ]),
  "president-call": scene("president-call", "Ligação do presidente", "board", [
    {
      id: "president-call.line.001",
      who: "narrator",
      text: "O telefone toca depois do jantar. É o presidente. Nunca é papo bom.",
    },
    {
      id: "president-call.line.002",
      who: "president",
      text: "O conselho quer resposta. Me diz: o título ainda é possível?",
    },
    {
      id: "president-call.line.003",
      who: "manager",
      text: "Respire fundo. O que você promete?",
      choices: [
        {
          id: "president-call.choice.01",
          label: "Prometer o título",
          hint: "Compra tempo — e uma corda",
          response: [
            {
              id: "president-call.line.004",
              who: "manager",
              text: "É possível. E eu vou entregar. Pode cobrar.",
            },
            {
              id: "president-call.line.005",
              who: "president",
              text: "Anotado. O conselho vai cobrar cada palavra.",
            },
          ],
          effect: { approval: 8, pressure: 8, headline: "Treinador promete título ao conselho" },
        },
        {
          id: "president-call.choice.02",
          label: "Pedir paciência",
          hint: "Honesto, mas o crédito cai",
          response: [
            {
              id: "president-call.line.006",
              who: "manager",
              text: "Título se constrói. Me dê a temporada e eu devolvo um time.",
            },
            {
              id: "president-call.line.007",
              who: "president",
              text: "Paciência tem prazo. Não me faça arrepender.",
            },
          ],
          effect: { approval: -5, pressure: -4, headline: "Treinador pede paciência à diretoria" },
        },
      ],
    },
  ]),
};

/** Sequência imersiva antes do apito inicial. */
export const PREMATCH_SCENE_IDS = [
  "prematch-locker",
  "prematch-kit",
  "prematch-tunnel",
  "prematch-whistle",
] as const;

/** Continuidade cinematográfica entre o apito final e o relatório. */
export const POSTMATCH_SCENE_IDS = [
  "postmatch-tunnel",
  "postmatch-locker",
  "postmatch-press",
] as const;

/** Cenas de treino sorteadas semana a semana no modo carreira. */
export const TRAINING_SCENE_IDS = [
  "training-warmup",
  "training-tactics",
  "training-finishing",
  "training-gym",
  "training-talk",
  "staffroom",
] as const;

/** Cenas de momento sorteadas ao longo da temporada. */
export const MOMENT_SCENE_IDS = [
  "bus-arrival",
  "warmup-pitch",
  "team-talk",
  "coin-toss",
  "anthem",
  "crowd-entry",
  "goal-roar",
  "penalty-decisive",
  "red-card",
  "substitution",
  "halftime-fix",
  "press-after-win",
  "press-after-loss",
  "trophy-lift",
  "promotion-night",
  "relegation-night",
  "derby-week-buildup",
  "scout-report",
  "agent-offer",
  "board-review",
  "youth-debut-night",
  "medical-room",
  "fan-meeting",
  "contract-renewal",
  "season-farewell",
] as const;

/** Todas as cenas que a galeria pode listar. */
export const SCENE_LIST = Object.values(CUTSCENES);

/** Cenas do arco de história: crise, ultimato, demissão, reconstrução e lendas. */
export const STORY_SCENE_IDS = [
  "season-kickoff",
  "crisis-meeting",
  "ultimatum",
  "captain-split",
  "dressing-unity",
  "mind-games",
  "captain-injury",
  "academy-gem",
  "transfer-saga",
  "deadline-day",
  "cup-final-eve",
  "relegation-fight",
  "sacking-night",
  "job-interview",
  "rebuild-day-one",
  "legend-retirement",
  "unbeatable-run",
  "captain-100",
  "injury-crisis",
  "fan-fury",
  "board-pleased",
  "empty-seats",
] as const;

/** As 25 cenas híbridas: câmera 3D real (perspectiva, plano de chão, paralaxe). */
for (const id of MOMENT_SCENE_IDS) {
  const s = CUTSCENES[id];
  if (s) s.hybrid = true;
}

/** O arco de história também ganha perspectiva 3D (os cenários já existem). */
for (const id of STORY_SCENE_IDS) {
  const s = CUTSCENES[id];
  if (s) s.hybrid = true;
}

/** Cenas jogáveis: têm escolha com consequência na carreira. */
export const CHOICE_SCENE_IDS = [
  "agent-demands",
  "unhappy-knock",
  "derby-eve-talk",
  "doctor-gamble",
  "president-call",
] as const;

for (const id of CHOICE_SCENE_IDS) {
  const s = CUTSCENES[id];
  if (s) s.hybrid = true;
}
