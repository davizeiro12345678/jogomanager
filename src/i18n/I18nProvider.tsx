import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { isRuntimeApprovedLocale, type RuntimeApprovedLang } from "./locale-runtime-manifest";
import { RTL_LANGS, resolveLang, type Lang } from "./locale-identifiers";
import { translateBootstrap } from "./bootstrap-messages";
import { reportSilent } from "@/lib/silent-errors";
import { I18nContext, I18nValue } from "@/i18n/context";
import { useLocation } from "@tanstack/react-router";
import { isPublicContentPath } from "@/lib/public-content-routes";

// Preserve the synchronous, complete translation API for direct consumers.
// Production UI consumes useT; only the allowlisted legacy packs are optional.
const STORAGE_KEY = "pfm3d.lang";

function detect(): RuntimeApprovedLang {
  if (typeof window === "undefined") return "pt-BR";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const selected = resolveLang(saved ?? undefined);
    if (selected && isRuntimeApprovedLocale(selected)) return selected;
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
    if (supported && isRuntimeApprovedLocale(supported)) return supported;
  }
  return "pt-BR";
}

type Translator = typeof import("./messages").translateRuntime;

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<RuntimeApprovedLang>("pt-BR");
  const pathname = useLocation({ select: (location) => location.pathname });
  const [loadedTranslator, setLoadedTranslator] = useState<Translator | null>(null);

  useEffect(() => {
    setLangState(detect());
  }, []);

  // Language packs fill strings that would otherwise fall back to English.
  // Draft locales never reach this effect because detect/setLang are allowlisted.
  useEffect(() => {
    setLoadedTranslator(null);
    if (lang === "pt-BR" || lang === "en") return;
    let active = true;
    const controller = new AbortController();
    void import("./messages")
      .then(async (module) => {
        try {
          const { loadLocalePack } = await import("./locale-pack-loader");
          const pack = await loadLocalePack(lang, {
            signal: controller.signal,
          });
          if (!active) return;
          module.registerLanguagePack(lang, pack);
        } catch (error) {
          if (controller.signal.aborted) return;
          reportSilent("i18n.translation", error, {
            classification: "degradation",
            feature: "translation-catalog",
            phase: "load",
            dedupeKey: `translation:${lang}`,
          });
        }
        if (!active) return;
        // Keep the previously published locale strings available if its pack is offline.
        setLoadedTranslator(() => (l: Lang, key: string) => module.translateRuntime(l, key));
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        reportSilent("i18n.translation", error, {
          classification: "degradation",
          feature: "translation-catalog",
          phase: "load",
          dedupeKey: `translation:${lang}`,
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    if (!isRuntimeApprovedLocale(l)) return;
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
