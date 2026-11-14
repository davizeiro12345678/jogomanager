import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Pareamento automático",
  description: "Encontre um adversário online com regras de pareamento do servidor.",
  casual: "Casual",
  ranked: "Ranqueada",
  join: "Procurar partida",
  cancel: "Cancelar busca",
  waiting: "Procurando adversário. A busca pode levar alguns instantes.",
  reserved: "Adversário encontrado. Preparando a partida segura.",
  unavailable: "O pareamento está temporariamente indisponível.",
  error: "Não foi possível atualizar o pareamento.",
  joining: "Entrando na fila…",
  matched: "Partida encontrada. Abrindo a sala.",
};
export const MULTIPLAYER_MATCHMAKING_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    title: "Automatic matchmaking",
    description: "Find an online opponent using server-side matchmaking rules.",
    casual: "Casual",
    ranked: "Ranked",
    join: "Find a match",
    cancel: "Cancel search",
    waiting: "Looking for an opponent. This may take a moment.",
    reserved: "Opponent found. Preparing the secure match.",
    unavailable: "Matchmaking is temporarily unavailable.",
    error: "Unable to refresh matchmaking.",
    joining: "Joining the queue…",
    matched: "Match found. Opening the room.",
  },
  es: {
    title: "Emparejamiento automático",
    description: "Encuentra un rival en línea con reglas de emparejamiento del servidor.",
    casual: "Casual",
    ranked: "Clasificatoria",
    join: "Buscar partida",
    cancel: "Cancelar búsqueda",
    waiting: "Buscando un rival. Esto puede tardar un momento.",
    reserved: "Rival encontrado. Preparando la partida segura.",
    unavailable: "El emparejamiento está temporalmente indisponible.",
    error: "No se pudo actualizar el emparejamiento.",
    joining: "Entrando en la cola…",
    matched: "Partida encontrada. Abriendo la sala.",
  },
};
export const multiplayerMatchmakingMessages = (lang: Lang) =>
  featureMessages(lang, MULTIPLAYER_MATCHMAKING_MESSAGES);
