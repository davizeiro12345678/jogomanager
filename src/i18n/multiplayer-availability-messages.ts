import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Multiplayer online",
  oneAvailable: "1×1 disponível",
  oneDescription: "Um jogador por equipe.",
  twoPending: "2×2 em validação",
  unavailable: "Ainda indisponível.",
  signIn: "O modo 1×1 precisa de uma conta para identificar os dois jogadores.",
  intro: "Crie uma sala, mande o código e joguem a mesma partida ao vivo, cada um no seu aparelho.",
  signInAction: "Entrar ou criar conta",
  backToDashboard: "Voltar ao painel",
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
    intro: "Create a room, share the code, and play the same match live on separate devices.",
    signInAction: "Sign in or create an account",
    backToDashboard: "Back to dashboard",
  },
  es: {
    title: "Multijugador en línea",
    oneAvailable: "1×1 disponible",
    oneDescription: "Un jugador por equipo.",
    twoPending: "2×2 en validación",
    unavailable: "Todavía no disponible.",
    signIn: "El modo 1×1 requiere una cuenta para identificar a ambos jugadores.",
    intro: "Crea una sala, comparte el código y jueguen el mismo partido en directo desde distintos dispositivos.",
    signInAction: "Iniciar sesión o crear cuenta",
    backToDashboard: "Volver al panel",
  },
};

export const multiplayerAvailabilityMessages = (lang: Lang) => featureMessages(lang, messages);
