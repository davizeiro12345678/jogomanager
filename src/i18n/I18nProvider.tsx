import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { LANGS, RTL_LANGS, resolveLang, type Lang } from "./locale-identifiers";

import { translateBootstrap } from "./bootstrap-messages";

import { reportSilent } from "@/lib/silent-errors";

import { I18nContext, I18nValue } from "@/i18n/context";
import { useLocation } from "@tanstack/react-router";
import { isPublicContentPath } from "@/lib/public-content-routes";

// Preserve the synchronous, complete translation API for direct consumers.
// Production UI consumes useT; its optional language pack stays a dynamic import.

const STORAGE_KEY = "pfm3d.lang";

function detect(): Lang {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const selected = resolveLang(saved ?? undefined);
    if (selected) return selected;
  } catch (error) {
    reportSilent("storage.preference", error, {
      classification: "ignorable",
      feature: "i18n",
      phase: "read",
      dedupeKey: "i18n-storage-read",
    });
  }
  for (const nav of window.navigator.languages ?? [window.navigator.language]) {
    const supported = resolveLang(nav);
    if (supported) return supported;
  }
  return "pt-BR";
}

type Translator = typeof import("./messages").translate;

const PACK_LOADERS = import.meta.glob<{ default: Record<string, string> }>("./packs/*.json");

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt-BR");
  const pathname = useLocation({ select: (location) => location.pathname });
  const [loadedTranslator, setLoadedTranslator] = useState<Translator | null>(null);
  useEffect(() => {
    setLangState(detect());
  }, []);
  // Language packs fill strings that would otherwise fall back to English.
  useEffect(() => {
    if (lang === "pt-BR" || lang === "en") return;
    let active = true;
    const packPath = `./packs/${lang}.json`;
    const loadPack = PACK_LOADERS[packPath];
    void Promise.all([import("./messages"), loadPack ? loadPack() : Promise.resolve(null)])
      .then(([module, pack]) => {
        if (!active) return;
        if (pack) module.registerLanguagePack(lang, pack.default);
        // A fresh wrapper re-renders consumers once this language's pack registers.
        setLoadedTranslator(() => (l: Lang, key: string) => module.translate(l, key));
      })
      .catch((error) => {
        reportSilent("i18n.translation", error, {
          classification: "degradation",
          feature: "translation-catalog",
          phase: "load",
          dedupeKey: `translation:${lang}`,
        });
      });
    return () => {
      active = false;
    };
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    if (!(LANGS as readonly string[]).includes(l)) return;
    setLangState(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch (error) {
      reportSilent("storage.preference", error, {
        classification: "ignorable",
        feature: "i18n",
        phase: "write",
        dedupeKey: "i18n-storage-write",
      });
    }
  }, []);
  const dir: "ltr" | "rtl" = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  useEffect(() => {
    const isEditorial = isPublicContentPath(pathname);
    document.documentElement.lang = isEditorial ? "pt-BR" : lang;
    document.documentElement.dir = isEditorial ? "ltr" : dir;
  }, [lang, dir, pathname]);
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
