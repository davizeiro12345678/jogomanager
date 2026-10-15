/** prematch cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const prematchScenes: Record<string, Cutscene> = {
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
};
