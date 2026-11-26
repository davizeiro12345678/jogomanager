import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Multiplayer online",
  oneAvailable: "1×1 disponível",
  oneDescription: "Um jogador por equipe.",
  twoPending: "2×2 em validação",
  unavailable: "Ainda indisponível.",
  signIn: "O modo 1×1 precisa de uma conta para identificar os dois jogadores.",
};

const messages: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    title: "Online multiplayer",
    oneAvailable: "1×1 available",
    oneDescription: "One player per team.",
    twoPending: "2×2 under validation",
    unavailable: "Not available yet.",
    signIn: "The 1×1 mode requires an account to identify both players.",
  },
  es: {
    title: "Multijugador en línea",
    oneAvailable: "1×1 disponible",
    oneDescription: "Un jugador por equipo.",
    twoPending: "2×2 en validación",
    unavailable: "Todavía no disponible.",
    signIn: "El modo 1×1 requiere una cuenta para identificar a ambos jugadores.",
  },
};

export const multiplayerAvailabilityMessages = (lang: Lang) => featureMessages(lang, messages);
