import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  alternative: "Acesso alternativo",
  unavailableTitle: "Acesso à conta indisponível",
  unavailableHint: "Não foi possível iniciar o serviço de login. Tente novamente mais tarde.",
  backToGame: "Voltar ao jogo",
  playAsGuest: "Continuar como convidado",
  hint: "Não conseguiu entrar? Tente o acesso alternativo da mesma conta.",
  withProvider: "Acesso alternativo com",
  emailFallback:
    "Se o acesso com um provedor estiver indisponível, use o e-mail da mesma conta abaixo.",
};
export const AUTH_RECOVERY_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    alternative: "Alternative sign-in",
    unavailableTitle: "Sign-in unavailable",
    unavailableHint: "The sign-in service could not be started. Please try again later.",
    backToGame: "Return to the game",
    playAsGuest: "Continue as a guest",
    hint: "Could not sign in? Try the alternative route for the same account.",
    withProvider: "Alternative sign-in with",
    emailFallback: "If a provider is unavailable, use the email for the same account below.",
  },
  es: {
    alternative: "Acceso alternativo",
    unavailableTitle: "Acceso a la cuenta no disponible",
    unavailableHint: "No se pudo iniciar el servicio de acceso. Inténtalo de nuevo más tarde.",
    backToGame: "Volver al juego",
    playAsGuest: "Continuar como invitado",
    hint: "¿No has podido entrar? Prueba el acceso alternativo de la misma cuenta.",
    withProvider: "Acceso alternativo con",
    emailFallback:
      "Si un proveedor no está disponible, utiliza el correo de la misma cuenta a continuación.",
  },
};
export const authRecoveryMessages = (lang: Lang) => featureMessages(lang, AUTH_RECOVERY_MESSAGES);
