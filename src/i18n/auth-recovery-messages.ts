import type { Lang } from "./locale-catalog";
import { featureMessages, type FeatureMessages } from "./feature-messages";

const pt = {
  alternative: "Acesso alternativo",
  hint: "Não conseguiu entrar? Tente o acesso alternativo da mesma conta.",
  withProvider: "Acesso alternativo com",
  emailFallback:
    "Se o acesso com um provedor estiver indisponível, use o e-mail da mesma conta abaixo.",
};
export const AUTH_RECOVERY_MESSAGES: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    alternative: "Alternative sign-in",
    hint: "Could not sign in? Try the alternative route for the same account.",
    withProvider: "Alternative sign-in with",
    emailFallback: "If a provider is unavailable, use the email for the same account below.",
  },
  es: {
    alternative: "Acceso alternativo",
    hint: "¿No has podido entrar? Prueba el acceso alternativo de la misma cuenta.",
    withProvider: "Acceso alternativo con",
    emailFallback:
      "Si un proveedor no está disponible, utiliza el correo de la misma cuenta a continuación.",
  },
};
export const authRecoveryMessages = (lang: Lang) => featureMessages(lang, AUTH_RECOVERY_MESSAGES);
