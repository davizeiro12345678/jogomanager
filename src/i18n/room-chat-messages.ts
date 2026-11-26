import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  heading: "Chat privado da sala",
  showOpponent: "Mostrar mensagens do adversário",
  hideOpponent: "Ocultar mensagens do adversário",
  show: "Mostrar",
  mute: "Silenciar",
  reportLabel: "Denunciar abuso ou comportamento suspeito no multiplayer",
  report: "Denunciar",
  checking: "Verificando acesso à sala…",
  unavailable: "O chat desta sala não está disponível para este participante.",
  empty: "Converse com seu adversário aqui.",
  hidden:
    "As mensagens do adversário estão ocultas neste aparelho. A moderação do servidor continua ativa.",
  you: "Você",
  opponent: "Adversário",
  message: "Mensagem…",
  send: "Enviar mensagem",
};
export const ROOM_CHAT_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    heading: "Private room chat",
    showOpponent: "Show opponent messages",
    hideOpponent: "Hide opponent messages",
    show: "Show",
    mute: "Mute",
    reportLabel: "Report abusive or suspicious multiplayer behavior",
    report: "Report",
    checking: "Checking room access…",
    unavailable: "The room chat is unavailable to this participant.",
    empty: "Talk to your opponent here.",
    hidden: "Opponent messages are hidden on this device. Server moderation remains active.",
    you: "You",
    opponent: "Opponent",
    message: "Message…",
    send: "Send message",
  },
  es: {
    heading: "Chat privado de la sala",
    showOpponent: "Mostrar mensajes del rival",
    hideOpponent: "Ocultar mensajes del rival",
    show: "Mostrar",
    mute: "Silenciar",
    reportLabel: "Denunciar abuso o comportamiento sospechoso en multijugador",
    report: "Denunciar",
    checking: "Verificando acceso a la sala…",
    unavailable: "El chat no está disponible para este participante.",
    empty: "Habla con tu rival aquí.",
    hidden:
      "Los mensajes del rival se ocultan en este dispositivo. La moderación del servidor sigue activa.",
    you: "Tú",
    opponent: "Rival",
    message: "Mensaje…",
    send: "Enviar mensaje",
  },
};
export const roomChatMessages = (lang: Lang) => featureMessages(lang, ROOM_CHAT_MESSAGES);
