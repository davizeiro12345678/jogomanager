import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Multiplayer:",
  versus: "x",
  camera: "Câmera",
  chat: "Chat",
  chatLabel: "Conversa privada durante a partida",
  previewNotice: "Prévia visual local. O placar oficial é confirmado pelo servidor.",
  authorityConnecting: "Conectando ao servidor de partida autoritativo…",
  authorityConnected: "Placar oficial do servidor. A animação 3D continua sendo uma prévia visual.",
  authorityUnavailable: "Conexão oficial indisponível. Nenhum resultado local será publicado.",
  authorityForfeitPending: "Confirmando desistência…",
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
    authorityConnecting: "Connecting to the authoritative match server…",
    authorityConnected: "Official server scoreboard. The 3D animation is still a local preview.",
    authorityUnavailable: "Official connection unavailable. No local result will be published.",
    authorityForfeitPending: "Confirming forfeit…",
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
    authorityConnecting: "Conectando con el servidor autoritativo de partidos…",
    authorityConnected:
      "Marcador oficial del servidor. La animación 3D sigue siendo una vista local.",
    authorityUnavailable: "Conexión oficial no disponible. No se publicará un resultado local.",
    authorityForfeitPending: "Confirmando abandono…",
    qualityLabel: "Cambiar calidad gráfica, actual",
    reconnecting: "Reconectando",
    finish: "Finalizar",
    leave: "Abandonar",
  },
};
export const multiplayerLiveMessages = (lang: Lang) =>
  featureMessages(lang, MULTIPLAYER_LIVE_MESSAGES);
