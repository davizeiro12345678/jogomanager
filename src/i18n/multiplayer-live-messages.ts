import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Multiplayer:",
  versus: "x",
  camera: "Câmera",
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
    reconnecting: "Reconnecting",
    finish: "Finish",
    leave: "Leave",
  },
  es: {
    title: "Multijugador:",
    versus: "contra",
    camera: "Cámara",
    reconnecting: "Reconectando",
    finish: "Finalizar",
    leave: "Abandonar",
  },
};
export const multiplayerLiveMessages = (lang: Lang) =>
  featureMessages(lang, MULTIPLAYER_LIVE_MESSAGES);
