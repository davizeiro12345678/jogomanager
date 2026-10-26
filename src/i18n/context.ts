import { createContext, useContext } from "react";

import { type Lang } from "@/i18n/locale-catalog";

import { bootstrapMessageLanguage, translateBootstrap } from "@/i18n/bootstrap-messages";
import { formatMessage, type MessageValues } from "./format-message";

export interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, values?: MessageValues) => string;
  messageLanguage: (key: string) => Lang;
  dir: "ltr" | "rtl";
}

export const I18nContext = createContext<I18nValue>({
  lang: "pt-BR",
  setLang: () => undefined,
  t: (key, values) => formatMessage(translateBootstrap("pt-BR", key), values),
  messageLanguage: (key) => bootstrapMessageLanguage("pt-BR", key),
  dir: "ltr",
});

export function useT() {
  return useContext(I18nContext);
}
