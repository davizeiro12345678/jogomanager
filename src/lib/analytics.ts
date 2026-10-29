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
let initializing: Promise<PostHog | null> | null = null;
let firebaseAnalyticsRequested = false;

const MANAGED_POSTHOG_PROXY = "https://e.jogomanager.com";

function apiHost() {
  // Activate only after DNS + TLS readiness is verified. Until then use the
  // original PostHog ingestion host, so analytics keeps working during rollout.
  if (import.meta.env["VITE_POSTHOG_PROXY_HOST"] === MANAGED_POSTHOG_PROXY) {
    return MANAGED_POSTHOG_PROXY;
  }
  const region = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] || "us";
  return region === "eu" ? "https://eu.i.posthog.com" : "https://us.i.posthog.com";
}

export async function initAnalytics(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  // Analytics é opcional: só carrega depois do consentimento explícito.
  if (!readConsent().analytics) {
    client?.opt_out_capturing();
    if (gaId) window[`ga-disable-${gaId}`] = true;
    // Do not download the Firebase analytics bundle on browsers that never
    // consented to analytics. Disable it only if it was initialized before.
    if (firebaseAnalyticsRequested) {
      firebaseAnalyticsRequested = false;
      void import("./firebase").then((m) => m.disableFirebaseAnalytics()).catch(() => undefined);
    }
    return null;
  }
  initGoogleAnalytics();
  // One Firebase SDK/config initialization per consent grant, not one per
  // consent-changed notification or repeated analytics initialization call.
  if (!firebaseAnalyticsRequested) {
    firebaseAnalyticsRequested = true;
    void import("./firebase")
      .then((m) => (readConsent().analytics ? m.initFirebase({ analytics: true }) : null))
      .catch(() => undefined);
  }
  if (client) {
    if (client.has_opted_out_capturing()) client.opt_in_capturing();
    return client;
  }
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"];
  if (!token) return null;
  // Share the same asynchronous SDK initialization between concurrent callers.
  // The previous "starting" boolean returned null and dropped early callers.
  if (initializing) return initializing;
  initializing = (async (): Promise<PostHog | null> => {
    try {
      const { default: posthog } = await import("posthog-js");
      // Consent may have been revoked while the SDK chunk was downloading.
      if (!readConsent().analytics) return null;
      const host = apiHost();
      posthog.init(token, {
        api_host: host,
        ...(host === MANAGED_POSTHOG_PROXY
          ? { ui_host: "https://us.posthog.com" }
          : {}),
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
      initializing = null;
    }
  })();
  return initializing;
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
