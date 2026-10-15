/** history cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const historyScenes: Record<string, Cutscene> = {
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
};
