/** training cutscenes: authored narrative content only. */
import { scene, type Cutscene } from "../cutscene-types";

export const trainingScenes: Record<string, Cutscene> = {
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
};
