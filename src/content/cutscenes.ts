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
  | "farewell";

export type Speaker =
  | "manager"
  | "president"
  | "press"
  | "captain"
  | "narrator"
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
  assistant: "Auxiliar",
  doctor: "Médico",
  scout: "Olheiro",
  agent: "Empresário",
  fan: "Torcida",
};

export interface CutsceneLine {
  who: Speaker;
  text: string;
}

export type SceneMood = "good" | "bad" | "neutral";

export interface Cutscene {
  id: string;
  title: string;
  art: SceneArt;
  mood?: SceneMood;
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
      who: "narrator",
      text: "O carro para em frente ao centro de treinamento. Câmeras por toda parte.",
    },
    { who: "president", text: "Bem-vindo. A torcida está ansiosa — e a diretoria também." },
    { who: "manager", text: "Vim para trabalhar. Me dê tempo e time para brigar lá em cima." },
    { who: "narrator", text: "Portões se abrem. O escudo do clube brilha sob o sol da tarde." },
  ]),
  press: scene("press", "Apresentação à imprensa", "press", [
    { who: "press", text: "Qual é a meta para a temporada?" },
    { who: "manager", text: "Jogar bem, competir em tudo e devolver orgulho a esta camisa." },
    { who: "press", text: "E se os resultados demorarem?" },
    { who: "manager", text: "Aí eu trabalho mais. Não existe atalho." },
    { who: "narrator", text: "Os flashes disparam. O relógio da sua era começa agora." },
  ]),
  dressing: scene("dressing", "Vestiário antes do jogo", "dressing", [
    { who: "captain", text: "O grupo está pronto, professor." },
    { who: "manager", text: "Intensidade nos primeiros minutos. A torcida faz o resto." },
    { who: "narrator", text: "Chuteiras batem no piso. O corredor já ruge lá fora." },
  ]),
  tunnel: scene("tunnel", "Túnel de acesso", "tunnel", [
    { who: "narrator", text: "Luz no fim do túnel, som abafado de setenta mil pessoas." },
    { who: "captain", text: "Ninguém baixa a cabeça hoje." },
    { who: "manager", text: "Vamos jogar como treinamos. Simples assim." },
  ]),
  title: scene(
    "title",
    "Comemoração de título",
    "celebration",
    [
      { who: "narrator", text: "Confete, fogos e a taça erguida sob o estádio lotado." },
      { who: "fan", text: "É campeão! É campeão!" },
      { who: "manager", text: "Isto é de vocês. Amanhã já pensamos na próxima." },
    ],
    "good",
  ),

  /* ------------------------------------------------ treino */
  "training-warmup": scene("training-warmup", "Aquecimento", "training", [
    { who: "narrator", text: "Seis da manhã. Cones espalhados, orvalho ainda no gramado." },
    { who: "assistant", text: "Grupo completo. Dois em trabalho reduzido." },
    { who: "manager", text: "Começa leve. Quero todo mundo inteiro no domingo." },
  ]),
  "training-tactics": scene("training-tactics", "Trabalho tático", "tactics", [
    { who: "manager", text: "Linha alta, encurtando o campo. A bola volta rápido pra gente." },
    { who: "captain", text: "E se eles jogarem em contra-ataque longo?" },
    { who: "manager", text: "Aí o zagueiro mais rápido cobre e o lateral fecha por dentro." },
    { who: "assistant", text: "Ensaiado. Repetimos mais dez vezes até virar hábito." },
  ]),
  "training-finishing": scene("training-finishing", "Finalização", "training", [
    { who: "narrator", text: "Bola após bola cruzando a área. O goleiro reclama do ritmo." },
    { who: "manager", text: "Chute com o pé de apoio firme. Colocação antes de força." },
    { who: "captain", text: "Se o domingo for assim, ganhamos fácil." },
  ]),
  "training-gym": scene("training-gym", "Academia e recuperação", "gym", [
    { who: "doctor", text: "Cargas controladas. Dois atletas voltam de lesão nesta semana." },
    { who: "manager", text: "Sem pressa. Prefiro perder um jogo a perder um jogador." },
  ]),
  "training-talk": scene("training-talk", "Conversa individual", "staff", [
    {
      who: "manager",
      text: "Sei que você quer jogar mais. Eu preciso de você pronto quando chamar.",
    },
    { who: "captain", text: "Eu estou. Só quero minha chance." },
    { who: "manager", text: "Ela vem. Continue treinando assim." },
  ]),

  /* ------------------------------------------------ salas do clube */
  trophyroom: scene("trophyroom", "Sala de troféus", "trophy", [
    { who: "narrator", text: "Vidro, luz baixa e prateleiras que contam a história do clube." },
    { who: "president", text: "Cada taça aqui tem um nome por trás. Escreva o seu." },
    { who: "manager", text: "Vou encher uma prateleira inteira." },
  ]),
  staffroom: scene("staffroom", "Sala da comissão técnica", "staff", [
    { who: "assistant", text: "O quadro está pronto. Rival marca por pressão no lado direito." },
    { who: "doctor", text: "Elenco fisicamente bem, dois no limite de cartões." },
    { who: "scout", text: "Tenho três nomes baratos que resolvem o meio-campo." },
    { who: "manager", text: "Traga o relatório. Decidimos até sexta." },
  ]),
  board: scene("board", "Reunião com a diretoria", "board", [
    { who: "president", text: "Os números precisam fechar. E a torcida precisa sorrir." },
    { who: "manager", text: "Me dê a janela e eu entrego as duas coisas." },
    { who: "president", text: "Está anotado. Vamos cobrar." },
  ]),
  transferwindow: scene("transferwindow", "Janela de transferências", "transfer", [
    { who: "agent", text: "Meu jogador gosta do projeto. O salário é que precisa conversar." },
    { who: "manager", text: "Nós pagamos por rendimento, não por currículo." },
    { who: "scout", text: "Se ele recusar, tenho um garoto que faz o mesmo por metade." },
  ]),

  /* ------------------------------------------------ momentos de temporada */
  winstreak: scene(
    "winstreak",
    "Sequência de vitórias",
    "celebration",
    [
      { who: "narrator", text: "Três, quatro, cinco jogos. A cidade só fala do time." },
      { who: "press", text: "É o melhor momento do clube em anos. Qual o segredo?" },
      { who: "manager", text: "Trabalho chato e repetido, todo dia, sem holofote." },
    ],
    "good",
  ),
  comeback: scene(
    "comeback",
    "Virada histórica",
    "celebration",
    [
      { who: "narrator", text: "Estava perdido. Terminou em festa nos últimos minutos." },
      { who: "captain", text: "Ninguém acreditou em nós, professor." },
      { who: "manager", text: "Nós acreditamos. É o que importa." },
    ],
    "good",
  ),
  badloss: scene(
    "badloss",
    "Derrota dolorosa",
    "defeat",
    [
      { who: "narrator", text: "Vestiário em silêncio. Só o barulho do chuveiro ao fundo." },
      { who: "manager", text: "A culpa é minha. A resposta é de todos nós, na próxima." },
      { who: "captain", text: "Vamos dar essa resposta." },
    ],
    "bad",
  ),
  sackrisk: scene(
    "sackrisk",
    "Reunião de emergência",
    "board",
    [
      { who: "president", text: "Não posso segurar a pressão por muito mais tempo." },
      { who: "manager", text: "Me dê três jogos. Você vai ver outro time." },
      { who: "president", text: "Três. Nem um a mais." },
    ],
    "bad",
  ),
  promotion: scene(
    "promotion",
    "Acesso conquistado",
    "celebration",
    [
      { who: "narrator", text: "Invasão de campo, bandeirões e o apito final mais longo do ano." },
      { who: "fan", text: "Subimos! Subimos!" },
      { who: "manager", text: "Agora começa a parte difícil: se manter lá em cima." },
    ],
    "good",
  ),
  farewell: scene(
    "farewell",
    "Despedida",
    "farewell",
    [
      { who: "narrator", text: "Malas no corredor. O escudo fica; o treinador segue." },
      { who: "manager", text: "Obrigado por tudo. Este clube me ensinou mais do que eu ensinei." },
      { who: "fan", text: "Volte sempre, professor." },
    ],
    "bad",
  ),
  "cup-draw": scene("cup-draw", "Sorteio da copa", "board", [
    {
      who: "narrator",
      text: "Bolinhas giram no globo de vidro. A sala inteira prende a respiração.",
    },
    { who: "press", text: "E o adversário do seu time na próxima fase é..." },
    { who: "manager", text: "Seja quem for, a gente estuda e enfrenta. Copa é jogo de detalhe." },
    { who: "assistant", text: "Já peço os vídeos dos últimos cinco jogos deles." },
  ]),
  "press-defeat": scene(
    "press-defeat",
    "Coletiva após a derrota",
    "press",
    [
      { who: "narrator", text: "Sala apertada, microfones ligados, ninguém sorrindo." },
      { who: "press", text: "O time não criou nada. O senhor errou a escalação?" },
      {
        who: "manager",
        text: "A responsabilidade é minha. Amanhã cedo estamos no campo corrigindo.",
      },
      { who: "press", text: "A diretoria te garantiu no cargo?" },
      { who: "manager", text: "Meu emprego se garante ganhando. É o que pretendo fazer." },
    ],
    "bad",
  ),
  renewal: scene(
    "renewal",
    "Renovação de contrato",
    "board",
    [
      {
        who: "president",
        text: "O conselho aprovou por unanimidade. Queremos você por mais tempo.",
      },
      { who: "manager", text: "Aceito — mas quero decidir as contratações da próxima janela." },
      { who: "president", text: "Fechado. Assine aqui e vamos brindar." },
      {
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
        who: "narrator",
        text: "Estádio cheio num amistoso de terça. Todos vieram por um homem só.",
      },
      { who: "captain", text: "Foram doze anos. Vou sentir falta do cheiro da grama molhada." },
      { who: "fan", text: "Eterno! Eterno!" },
      {
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
      { who: "narrator", text: "Papel picado no ar, o gramado some debaixo da festa." },
      { who: "captain", text: "Professor, essa taça é sua também. Sobe aí com a gente." },
      { who: "manager", text: "É de todo mundo. Do roupeiro ao torcedor que veio na chuva." },
      { who: "fan", text: "Campeão! Campeão!" },
      { who: "narrator", text: "A taça sobe. A cidade não dorme hoje." },
    ],
    "good",
  ),
  "derby-week": scene("derby-week", "Semana de clássico", "dressing", [
    {
      who: "narrator",
      text: "A cidade amanheceu dividida. Bandeiras nas janelas, faixas nos postes.",
    },
    { who: "captain", text: "Professor, esse aqui vale por três." },
    { who: "manager", text: "Vale por um. Mas jogamos como se valesse a temporada inteira." },
    { who: "assistant", text: "Marcação individual nas bolas paradas. Eles vivem disso." },
  ]),
  "youth-debut-night": scene(
    "youth-debut-night",
    "Estreia do garoto da base",
    "tunnel",
    [
      { who: "scout", text: "Ele treina com o profissional desde os quinze. Está pronto." },
      { who: "manager", text: "Garoto, joga do teu jeito. Se errar, o erro é meu." },
      { who: "narrator", text: "O número dele aparece na quarta placa. O estádio levanta." },
    ],
    "good",
  ),
  /* ------------------------------------------------ antes do apito */
  "prematch-locker": scene("prematch-locker", "Vestiário", "dressing", [
    { who: "narrator", text: "Cheiro de cânfora, rádio baixinho e o quadro tático ainda molhado." },
    { who: "assistant", text: "Escalação no quadro, professor. Todos liberados pelo departamento." },
    { who: "manager", text: "Primeiros quinze minutos intensos. Depois a gente controla o jogo." },
    { who: "captain", text: "O grupo entendeu. Ninguém sai de campo com dúvida hoje." },
  ]),
  "prematch-kit": scene("prematch-kit", "Vestindo a camisa", "kitroom", [
    { who: "narrator", text: "Camisas numeradas penduradas em fila, cada uma no seu gancho." },
    { who: "captain", text: "Essa camisa pesa. Hoje ela pesa a nosso favor." },
    { who: "manager", text: "Veste com respeito. Tem gente na arquibancada que juntou a semana pra estar aqui." },
    { who: "narrator", text: "Chuteiras amarradas, caneleiras no lugar, o último abraço no roupeiro." },
  ]),
  "prematch-tunnel": scene("prematch-tunnel", "Túnel de acesso", "tunnel", [
    { who: "narrator", text: "Fila formada no escuro. Lá na frente, a boca do túnel em luz branca." },
    { who: "captain", text: "Mão na mão. Ninguém anda sozinho aqui." },
    { who: "manager", text: "Cabeça erguida. O jogo começa no primeiro passo." },
    { who: "fan", text: "Vamos, vamos, o time não pode parar!" },
  ]),
  "prematch-whistle": scene("prematch-whistle", "O apito inicial", "pitchentry", [
    { who: "narrator", text: "O gramado abre em verde sob os refletores. Setenta mil de pé." },
    { who: "narrator", text: "Moeda no ar, aperto de mãos, bola no círculo central." },
    { who: "manager", text: "Agora é com vocês." },
    { who: "narrator", text: "O árbitro leva o apito à boca. Começa o jogo." },
  ]),

  "injury-blow": scene(
    "injury-blow",
    "Lesão do craque",
    "gym",
    [
      { who: "doctor", text: "Exame confirmou. Fora por seis semanas, no melhor cenário." },
      { who: "manager", text: "Ninguém substitui ele sozinho. Vamos substituir em quatro." },
      { who: "captain", text: "O grupo cobre. Diga só como você quer." },
    ],
    "bad",
  ),

  /* ------------------------------------------------ novas cenas de jornada */
  "bus-arrival": scene("bus-arrival", "Chegada do ônibus", "arrival", [
    { who: "narrator", text: "Sinalizadores vermelhos cercam o ônibus a dois quarteirões do estádio." },
    { who: "captain", text: "Olha o tamanho disso, professor." },
    { who: "manager", text: "É por isso que a gente treina. Aproveita cada metro desse corredor." },
  ]),
  "warmup-pitch": scene("warmup-pitch", "Aquecimento no gramado", "training", [
    { who: "assistant", text: "Gramado firme, bola corre. Chuteira de trava curta serve." },
    { who: "manager", text: "Avisa a linha de trás: bola rápida exige linha mais compacta." },
  ]),
  "team-talk": scene("team-talk", "Preleção final", "dressing", [
    { who: "manager", text: "Três coisas: pressão alta, bola pro lado forte, ninguém reclama do árbitro." },
    { who: "captain", text: "Entendido. A gente resolve dentro de campo." },
  ]),
  "coin-toss": scene("coin-toss", "Sorteio no círculo", "pitchentry", [
    { who: "narrator", text: "Capitães frente a frente. A moeda sobe e brilha sob o refletor." },
    { who: "captain", text: "Escolhemos o campo. O vento vem do nosso lado no segundo tempo." },
  ]),
  anthem: scene("anthem", "Hino no gramado", "pitchentry", [
    { who: "narrator", text: "Bandeirão cobre a arquibancada inteira, de trave a trave." },
    { who: "fan", text: "Canta, canta, essa camisa é nossa vida!" },
    { who: "manager", text: "Se o time jogar com metade disso, ninguém segura." },
  ]),
  "crowd-entry": scene("crowd-entry", "Entrada da torcida", "pitchentry", [
    { who: "narrator", text: "Portões abrem e a arquibancada enche em ondas de cor." },
    { who: "fan", text: "Chegamos cedo porque hoje não dá pra perder nada." },
  ]),
  "goal-roar": scene(
    "goal-roar",
    "O gol que explodiu o estádio",
    "celebration",
    [
      { who: "narrator", text: "A bola entra no ângulo e o estádio inteiro sai do chão." },
      { who: "fan", text: "Gooool! Gooool!" },
      { who: "manager", text: "Comemora rápido e volta pra posição. O jogo não acabou." },
    ],
    "good",
  ),
  "penalty-decisive": scene(
    "penalty-decisive",
    "Pênalti decisivo",
    "pitchentry",
    [
      { who: "narrator", text: "Bola na marca da cal, goleiro dançando na linha." },
      { who: "captain", text: "Deixa comigo, professor." },
      { who: "narrator", text: "Silêncio absoluto por dois segundos. Depois, o barulho." },
    ],
    "good",
  ),
  "red-card": scene(
    "red-card",
    "Cartão vermelho",
    "tactics",
    [
      { who: "narrator", text: "O árbitro leva a mão ao bolso e o estádio protesta em coro." },
      { who: "manager", text: "Um a menos: fecha o meio, joga com a linha baixa e contra-ataque." },
      { who: "captain", text: "Ninguém entra em desespero. Um passe de cada vez." },
    ],
    "bad",
  ),
  substitution: scene("substitution", "A troca que muda o jogo", "tactics", [
    { who: "assistant", text: "Ele está a mil. Entrando agora, pega a zaga cansada." },
    { who: "manager", text: "Entra pelo lado, encara o marcador e não pensa duas vezes." },
  ]),
  "halftime-fix": scene("halftime-fix", "Intervalo", "dressing", [
    { who: "manager", text: "Perdemos o meio-campo. Um volante recua, o lateral sobe por dentro." },
    { who: "captain", text: "Melhor assim. Estávamos correndo atrás da sombra deles." },
  ]),
  "press-after-win": scene(
    "press-after-win",
    "Coletiva após a vitória",
    "press",
    [
      { who: "press", text: "Foi a melhor atuação do ano?" },
      { who: "manager", text: "Foi a mais madura. Melhor não existe enquanto a temporada corre." },
    ],
    "good",
  ),
  "press-after-loss": scene(
    "press-after-loss",
    "Coletiva após a derrota",
    "press",
    [
      { who: "press", text: "O senhor sente o cargo ameaçado?" },
      { who: "manager", text: "Sinto responsabilidade. A resposta é no treino de segunda." },
    ],
    "bad",
  ),
  "trophy-lift": scene(
    "trophy-lift",
    "A taça erguida",
    "trophy",
    [
      { who: "narrator", text: "Papel picado, palco montado e a taça pesando nas mãos do capitão." },
      { who: "captain", text: "Isso aqui é de quem acordou cedo o ano inteiro." },
    ],
    "good",
  ),
  "promotion-night": scene(
    "promotion-night",
    "Noite do acesso",
    "celebration",
    [
      { who: "narrator", text: "Apito final e a cidade inteira parece ter entrado em campo." },
      { who: "president", text: "Subimos de divisão. Agora vem o difícil: ficar lá." },
    ],
    "good",
  ),
  "relegation-night": scene(
    "relegation-night",
    "Noite do rebaixamento",
    "defeat",
    [
      { who: "narrator", text: "Arquibancada vazia antes do apito. Silêncio pesado no gramado." },
      { who: "manager", text: "A culpa é minha. A reconstrução começa amanhã de manhã." },
    ],
    "bad",
  ),
  "derby-week-buildup": scene("derby-week-buildup", "Véspera de clássico", "tactics", [
    { who: "press", text: "Clássico se ganha no detalhe ou na raça?" },
    { who: "manager", text: "Nos dois. Detalhe pra criar, raça pra não devolver o que é nosso." },
  ]),
  "scout-report": scene("scout-report", "Relatório do olheiro", "staff", [
    { who: "scout", text: "Garoto de 19 anos, canhoto, joga por dentro e por fora." },
    { who: "manager", text: "Traz ele pra treinar com o grupo antes de qualquer proposta." },
  ]),
  "agent-offer": scene("agent-offer", "Proposta do empresário", "transfer", [
    { who: "agent", text: "Tenho uma oferta alta por ele. O jogador já sabe." },
    { who: "manager", text: "Se sair, sai pelo valor certo e com substituto assinado." },
  ]),
  "board-review": scene("board-review", "Reunião de diretoria", "board", [
    { who: "president", text: "Folha salarial no limite. Precisamos vender ou cortar." },
    { who: "manager", text: "Vendo um, promovo dois da base. Economia e identidade juntas." },
  ]),
  "youth-debut-night": scene(
    "youth-debut-night",
    "Estreia do garoto da base",
    "pitchentry",
    [
      { who: "assistant", text: "Ele chorou no vestiário quando viu a camisa com o nome dele." },
      { who: "manager", text: "Entra tranquilo. Erra pra frente que ninguém vai te cobrar." },
    ],
    "good",
  ),
  "medical-room": scene(
    "medical-room",
    "Departamento médico",
    "gym",
    [
      { who: "doctor", text: "Três atletas na fisioterapia. Dois voltam na semana que vem." },
      { who: "manager", text: "Nada de pressa. Recaída custa o dobro de jogos." },
    ],
    "bad",
  ),
  "fan-meeting": scene("fan-meeting", "Encontro com a torcida", "arrival", [
    { who: "fan", text: "A gente só quer ver o time correr, professor." },
    { who: "manager", text: "Correr é o mínimo. Prometo time organizado também." },
  ]),
  "contract-renewal": scene(
    "contract-renewal",
    "Renovação do capitão",
    "board",
    [
      { who: "captain", text: "Quero terminar a carreira aqui, mas preciso me sentir importante." },
      { who: "manager", text: "Você é a espinha do time. A diretoria já tem minha recomendação." },
    ],
    "good",
  ),
  "season-farewell": scene("season-farewell", "Último jogo da temporada", "farewell", [
    { who: "narrator", text: "Volta olímpica lenta, crianças no gramado, câmeras ao fundo." },
    { who: "manager", text: "Guarda essa imagem. Ela é o combustível da pré-temporada." },
  ]),
};

/** Sequência imersiva antes do apito inicial. */
export const PREMATCH_SCENE_IDS = [
  "prematch-locker",
  "prematch-kit",
  "prematch-tunnel",
  "prematch-whistle",
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
