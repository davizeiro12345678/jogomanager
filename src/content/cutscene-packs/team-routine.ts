/** team-routine cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const teamRoutineScenes: Record<string, Cutscene> = {
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
};
