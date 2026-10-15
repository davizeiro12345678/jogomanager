/** journey cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const journeyScenes: Record<string, Cutscene> = {
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
};
