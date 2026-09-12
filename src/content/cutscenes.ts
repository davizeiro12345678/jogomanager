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
    { who: "narrator", text: "O carro para em frente ao centro de treinamento. Câmeras por toda parte." },
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
    { who: "manager", text: "Sei que você quer jogar mais. Eu preciso de você pronto quando chamar." },
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
    { who: "narrator", text: "Bolinhas giram no globo de vidro. A sala inteira prende a respiração." },
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
      { who: "manager", text: "A responsabilidade é minha. Amanhã cedo estamos no campo corrigindo." },
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
      { who: "president", text: "O conselho aprovou por unanimidade. Queremos você por mais tempo." },
      { who: "manager", text: "Aceito — mas quero decidir as contratações da próxima janela." },
      { who: "president", text: "Fechado. Assine aqui e vamos brindar." },
      { who: "narrator", text: "Flashes, aperto de mão e uma caneta que vale uma temporada inteira." },
    ],
    "good",
  ),
  "idol-farewell": scene(
    "idol-farewell",
    "Despedida do ídolo",
    "farewell",
    [
      { who: "narrator", text: "Estádio cheio num amistoso de terça. Todos vieram por um homem só." },
      { who: "captain", text: "Foram doze anos. Vou sentir falta do cheiro da grama molhada." },
      { who: "fan", text: "Eterno! Eterno!" },
      { who: "manager", text: "A camisa sai de campo, mas a régua que ele deixou fica no vestiário." },
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
    { who: "narrator", text: "A cidade amanheceu dividida. Bandeiras nas janelas, faixas nos postes." },
    { who: "captain", text: "Professor, esse aqui vale por três." },
    { who: "manager", text: "Vale por um. Mas jogamos como se valesse a temporada inteira." },
    { who: "assistant", text: "Marcação individual nas bolas paradas. Eles vivem disso." },
  ]),
  "youth-debut": scene(
    "youth-debut",
    "Estreia do garoto da base",
    "tunnel",
    [
      { who: "scout", text: "Ele treina com o profissional desde os quinze. Está pronto." },
      { who: "manager", text: "Garoto, joga do teu jeito. Se errar, o erro é meu." },
      { who: "narrator", text: "O número dele aparece na quarta placa. O estádio levanta." },
    ],
    "good",
  ),
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
};



/** Cenas de treino sorteadas semana a semana no modo carreira. */
export const TRAINING_SCENE_IDS = [
  "training-warmup",
  "training-tactics",
  "training-finishing",
  "training-gym",
  "training-talk",
  "staffroom",
] as const;

/** Todas as cenas que a galeria pode listar. */
export const SCENE_LIST = Object.values(CUTSCENES);
