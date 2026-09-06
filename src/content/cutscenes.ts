/**
 * Roteiro das cutscenes 2D do jogo. Cada cena é um pequeno conjunto de
 * falas com um cenário ilustrado (desenhado em SVG/CSS no componente).
 */
export type SceneArt = "arrival" | "press" | "dressing" | "trophy";

export interface CutsceneLine {
  /** quem fala: "manager" usa o retrato do treinador */
  who: "manager" | "president" | "press" | "captain" | "narrator";
  text: string;
}

export interface Cutscene {
  id: string;
  title: string;
  art: SceneArt;
  lines: CutsceneLine[];
}

export const CUTSCENES: Record<string, Cutscene> = {
  arrival: {
    id: "arrival",
    title: "Chegada ao clube",
    art: "arrival",
    lines: [
      { who: "narrator", text: "O carro para em frente ao centro de treinamento. Câmeras por toda parte." },
      { who: "president", text: "Bem-vindo. A torcida está ansiosa — e a diretoria também." },
      { who: "manager", text: "Vim para trabalhar. Me dê tempo e time para brigar lá em cima." },
    ],
  },
  press: {
    id: "press",
    title: "Apresentação à imprensa",
    art: "press",
    lines: [
      { who: "press", text: "Qual é a meta para a temporada?" },
      { who: "manager", text: "Jogar bem, competir em tudo e devolver orgulho a esta camisa." },
      { who: "narrator", text: "Os flashes disparam. O relógio da sua era começa agora." },
    ],
  },
  dressing: {
    id: "dressing",
    title: "Vestiário antes do jogo",
    art: "dressing",
    lines: [
      { who: "captain", text: "O grupo está pronto, professor." },
      { who: "manager", text: "Intensidade nos primeiros minutos. A torcida faz o resto." },
    ],
  },
  title: {
    id: "title",
    title: "Comemoração de título",
    art: "trophy",
    lines: [
      { who: "narrator", text: "Confete, fogos e a taça erguida sob o estádio lotado." },
      { who: "manager", text: "Isto é de vocês. Amanhã já pensamos na próxima." },
    ],
  },
};
