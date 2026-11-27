import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  title: "Multiplayer online",
  oneAvailable: "1×1 disponível",
  oneUnavailable: "1×1 temporariamente indisponível",
  oneDescription: "Um jogador por equipe.",
  twoPending: "2×2 em validação",
  unavailable: "Ainda indisponível.",
  signIn: "O modo 1×1 precisa de uma conta para identificar os dois jogadores.",
  signInUnavailable:
    "O login está indisponível. Você pode jogar uma partida rápida neste aparelho.",
  intro: "Crie uma sala, mande o código e joguem a mesma partida ao vivo, cada um no seu aparelho.",
  signInAction: "Entrar ou criar conta",
  quickMatchAction: "Jogar partida rápida",
  backToDashboard: "Voltar ao painel",
};

const messages: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    title: "Online multiplayer",
    oneAvailable: "1×1 available",
    oneUnavailable: "1×1 temporarily unavailable",
    oneDescription: "One player per team.",
    twoPending: "2×2 under validation",
    unavailable: "Not available yet.",
    signIn: "The 1×1 mode requires an account to identify both players.",
    signInUnavailable: "Sign-in is unavailable. You can play a quick match on this device.",
    intro: "Create a room, share the code, and play the same match live on separate devices.",
    signInAction: "Sign in or create an account",
    quickMatchAction: "Play a quick match",
    backToDashboard: "Back to dashboard",
  },
  es: {
    title: "Multijugador en línea",
    oneAvailable: "1×1 disponible",
    oneUnavailable: "1×1 temporalmente no disponible",
    oneDescription: "Un jugador por equipo.",
    twoPending: "2×2 en validación",
    unavailable: "Todavía no disponible.",
    signIn: "El modo 1×1 requiere una cuenta para identificar a ambos jugadores.",
    signInUnavailable:
      "No se puede iniciar sesión. Puedes jugar un partido rápido en este dispositivo.",
    intro:
      "Crea una sala, comparte el código y jueguen el mismo partido en directo desde distintos dispositivos.",
    signInAction: "Iniciar sesión o crear cuenta",
    quickMatchAction: "Jugar un partido rápido",
    backToDashboard: "Volver al panel",
  },
};

export const multiplayerAvailabilityMessages = (lang: Lang) => featureMessages(lang, messages);
