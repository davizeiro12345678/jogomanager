/**
 * Análise de uso (PostHog).
 *
 * Só roda no navegador e apenas quando o token público está configurado.
 * Não enviamos e-mail, nome ou qualquer dado pessoal — apenas eventos de jogo
 * (partida iniciada, carreira criada, compra concluída) e navegação.
 */
import type { PostHog } from "posthog-js";
import { readConsent } from "./consent";

let client: PostHog | null = null;
let starting = false;

function apiHost() {
  const region = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] || "eu";
  return region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";
}

export async function initAnalytics(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  // Analytics é opcional: só carrega depois do consentimento explícito.
  if (!readConsent().analytics) {
    client?.opt_out_capturing();
    if (gaId) window[`ga-disable-${gaId}`] = true;
    void import("./firebase").then((m) => m.disableFirebaseAnalytics()).catch(() => undefined);
    return null;
  }
  initGoogleAnalytics();
  void import("./firebase").then((m) => m.initFirebase({ analytics: true })).catch(() => undefined);
  if (client) {
    if (client.has_opted_out_capturing()) client.opt_in_capturing();
    return client;
  }
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"];
  if (!token || starting) return null;
  starting = true;
  try {
    const { default: posthog } = await import("posthog-js");
    if (!readConsent().analytics) return null;
    posthog.init(token, {
      api_host: apiHost(),
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "identified_only",
      autocapture: false,
      disable_session_recording: true,
    });
    client = posthog;
    if (client.has_opted_out_capturing()) client.opt_in_capturing();
    return posthog;
  } catch {
    return null;
  } finally {
    starting = false;
  }
}

/** Google Analytics 4 (gtag.js) — carregado apenas no navegador. */
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let gaId: string | null = null;

function initGoogleAnalytics() {
  if (typeof window === "undefined") return;
  if (gaId) {
    window[`ga-disable-${gaId}`] = false;
    return;
  }
  const id = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY"];
  if (!id) return;
  gaId = id;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer || [];
  const gtag: GtagFn = (...args) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", id);
}

/** Registra uma nova tela (SPA) no Google Analytics. */
export function trackPageView(path: string) {
  try {
    if (gaId && readConsent().analytics) window.gtag?.("event", "page_view", { page_path: path });
  } catch {
    /* ignora: telemetria é best-effort */
  }
}

/** Registra um evento do jogo. Nunca lança: análise não pode quebrar a partida. */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (!readConsent().analytics) return;
  try {
    client?.capture(event, props);
  } catch {
    /* ignora: telemetria é best-effort */
  }
  try {
    if (gaId) window.gtag?.("event", event, props ?? {});
  } catch {
    /* ignora: telemetria é best-effort */
  }
}
