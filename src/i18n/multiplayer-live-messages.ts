import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Multiplayer:",
  versus: "x",
  camera: "Câmera",
  chat: "Chat",
  chatLabel: "Conversa privada durante a partida",
  previewNotice: "Prévia visual local. O placar oficial é confirmado pelo servidor.",
  qualityLabel: "Alterar qualidade gráfica, atual",
  reconnecting: "Reconectando",
  finish: "Encerrar",
  leave: "Abandonar",
};
export const MULTIPLAYER_LIVE_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    title: "Multiplayer:",
    versus: "vs",
    camera: "Camera",
    chat: "Chat",
    chatLabel: "Private match conversation",
    previewNotice: "Local visual preview. The official score is confirmed by the server.",
    qualityLabel: "Change graphics quality, current",
    reconnecting: "Reconnecting",
    finish: "Finish",
    leave: "Leave",
  },
  es: {
    title: "Multijugador:",
    versus: "contra",
    camera: "Cámara",
    chat: "Chat",
    chatLabel: "Conversación privada durante el partido",
    previewNotice: "Vista local. El marcador oficial lo confirma el servidor.",
    qualityLabel: "Cambiar calidad gráfica, actual",
    reconnecting: "Reconectando",
    finish: "Finalizar",
    leave: "Abandonar",
  },
};
export const multiplayerLiveMessages = (lang: Lang) =>
  featureMessages(lang, MULTIPLAYER_LIVE_MESSAGES);
