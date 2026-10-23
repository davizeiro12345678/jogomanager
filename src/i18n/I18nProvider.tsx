import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGS, RTL_LANGS, resolveLang, type Lang } from "./locale-catalog";
import { bootstrapMessageLanguage, translateBootstrap } from "./bootstrap-messages";
import { formatMessage } from "./format-message";
import { I18nContext, type I18nValue } from "./context";
import { reportSilent } from "@/lib/silent-errors";
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

type Messages = typeof import("./messages");
export function I18nProvider({ children, pathname }: { children: ReactNode; pathname?: string }) {
  return pathname === undefined ? (
    <RoutedI18nProvider>{children}</RoutedI18nProvider>
  ) : (
    <I18nProviderState pathname={pathname}>{children}</I18nProviderState>
  );
}

function RoutedI18nProvider({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  return <I18nProviderState pathname={pathname}>{children}</I18nProviderState>;
}

function I18nProviderState({ children, pathname }: { children: ReactNode; pathname: string }) {
  const [lang, setLangState] = useState<Lang>("pt-BR");
  const [loadedMessages, setLoadedMessages] = useState<Messages | null>(null);
  useEffect(() => {
    setLangState(detect());
  }, []);
  useEffect(() => {
    const needsExtendedInterface =
      pathname.endsWith("-studio.html") ||
      pathname.startsWith("/jogador/") ||
      pathname === "/match" ||
      pathname === "/partida-rapida" ||
      pathname === "/new";
    if (loadedMessages || ((lang === "pt-BR" || lang === "en") && !needsExtendedInterface)) return;
    let active = true;
    void import("./messages")
      .then((module) => {
        if (active) setLoadedMessages(module);
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
  }, [lang, loadedMessages, pathname]);
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
      t: (key, values) =>
        formatMessage((loadedMessages?.translate ?? translateBootstrap)(lang, key), values),
      messageLanguage: (key) =>
        (loadedMessages?.messageLanguage ?? bootstrapMessageLanguage)(lang, key),
    }),
    [lang, setLang, dir, loadedMessages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
