/** club-rooms cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const clubRoomsScenes: Record<string, Cutscene> = {
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
};
