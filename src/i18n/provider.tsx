import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LANGS, RTL_LANGS, resolveLang, type Lang } from "./locale-catalog";
import { translateBootstrap } from "./bootstrap-messages";
export { LANGS, LANG_NAMES, RTL_LANGS, type Lang } from "./locale-catalog";
// Preserve the synchronous, complete translation API for direct consumers.
// Production UI consumes useT; its optional language pack stays a dynamic import.

const STORAGE_KEY = "pfm3d.lang";

function detect(): Lang {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const selected = resolveLang(saved ?? undefined);
    if (selected) return selected;
  } catch {
    /* sem acesso ao storage */
  }
  for (const nav of window.navigator.languages ?? [window.navigator.language]) {
    const supported = resolveLang(nav);
    if (supported) return supported;
  }
  return "pt-BR";
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

type Translator = typeof import("./messages").translate;
const I18nContext = createContext<I18nValue>({
  lang: "pt-BR",
  setLang: () => undefined,
  t: (key) => translateBootstrap("pt-BR", key),
  dir: "ltr",
});
export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt-BR");
  const [loadedTranslator, setLoadedTranslator] = useState<Translator | null>(null);
  useEffect(() => {
    setLangState(detect());
  }, []);
  useEffect(() => {
    if (lang === "pt-BR" || lang === "en" || loadedTranslator) return;
    let active = true;
    void import("./messages")
      .then((module) => {
        if (active) setLoadedTranslator(() => module.translate);
      })
      .catch(() => {
        /* Keep the existing English fallback usable offline. */
      });
    return () => {
      active = false;
    };
  }, [lang, loadedTranslator]);
  const setLang = useCallback((l: Lang) => {
    if (!(LANGS as readonly string[]).includes(l)) return;
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage is optional */
    }
  }, []);
  const dir: "ltr" | "rtl" = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      dir,
      t: (key: string) => (loadedTranslator ?? translateBootstrap)(lang, key),
    }),
    [lang, setLang, dir, loadedTranslator],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useT() {
  return useContext(I18nContext);
}
