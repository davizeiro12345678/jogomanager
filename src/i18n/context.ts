import { createContext, useContext } from "react";

import { type Lang } from "@/i18n/locale-catalog";

import { translateBootstrap } from "@/i18n/bootstrap-messages";

export interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

export const I18nContext = createContext<I18nValue>({
  lang: "pt-BR",
  setLang: () => undefined,
  t: (key) => translateBootstrap("pt-BR", key),
  dir: "ltr",
});

export function useT() {
  return useContext(I18nContext);
}
