import { featureMessages, type FeatureMessages } from "./feature-messages";
import type { Lang } from "./locale-catalog";

const pt = {
  checking: "Verificando sua conta…",
  signInToBuy: "Entre na sua conta para comprar",
  guestDetails:
    "Entre grátis para comprar, salvar sua carreira na nuvem, usar o chat, jogar online e ganhar conquistas.",
  signInOrRegister: "Entrar ou criar conta",
  purchaseButton: "Entrar para comprar",
  coin: "moeda",
  coins: "moedas",
};
const messages: FeatureMessages<keyof typeof pt> = {
  pt,
  en: {
    checking: "Checking your account…",
    signInToBuy: "Sign in to make a purchase",
    guestDetails:
      "Sign in free to buy, save your career in the cloud, use chat, play online and earn achievements.",
    signInOrRegister: "Sign in or create an account",
    purchaseButton: "Sign in to buy",
    coin: "coin",
    coins: "coins",
  },
  es: {
    checking: "Verificando tu cuenta…",
    signInToBuy: "Inicia sesión para comprar",
    guestDetails:
      "Entra gratis para comprar, guardar tu carrera en la nube, usar el chat, jugar online y ganar logros.",
    signInOrRegister: "Iniciar sesión o crear una cuenta",
    purchaseButton: "Iniciar sesión para comprar",
    coin: "moneda",
    coins: "monedas",
  },
};

export const storeAccountMessages = (lang: Lang) => featureMessages(lang, messages);
