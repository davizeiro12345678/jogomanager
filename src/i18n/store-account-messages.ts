import { featureMessages, type FeatureMessages } from "./feature-messages";
import type { Lang } from "./locale-catalog";

const pt = {
  checking: "Verificando sua conta…",
  signInToBuy: "Entre na sua conta para comprar",
  guestDetails:
    "Visitantes sem login não podem fazer compras, salvar a carreira na nuvem, usar o chat, jogar online nem receber conquistas. Entrar é grátis e leva poucos segundos.",
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
      "Sign in to buy items, save your career to the cloud, use chat, play online and earn achievements. Signing in is free and takes a few seconds.",
    signInOrRegister: "Sign in or create an account",
    purchaseButton: "Sign in to buy",
    coin: "coin",
    coins: "coins",
  },
  es: {
    checking: "Verificando tu cuenta…",
    signInToBuy: "Inicia sesión para comprar",
    guestDetails:
      "Inicia sesión para comprar, guardar tu carrera en la nube, usar el chat, jugar en línea y obtener logros. Es gratis y solo toma unos segundos.",
    signInOrRegister: "Iniciar sesión o crear una cuenta",
    purchaseButton: "Iniciar sesión para comprar",
    coin: "moneda",
    coins: "monedas",
  },
};

export const storeAccountMessages = (lang: Lang) => featureMessages(lang, messages);
