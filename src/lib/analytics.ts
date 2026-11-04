/**
 * Análise de uso (PostHog).
 *
 * Só roda no navegador e apenas quando o token público está configurado.
 * Não enviamos e-mail, nome ou qualquer dado pessoal — apenas eventos de jogo
 * (partida iniciada, carreira criada, compra concluída) e navegação.
 */
import type { PostHog } from "posthog-js";

let client: PostHog | null = null;
let initTask: Promise<PostHog | null> | null = null;
let firebaseBootstrapStarted = false;
let analyticsAllowed = false;

function apiHost() {
  const region = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] || "eu";
  return region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";
}

export async function initAnalytics(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  // Analytics only starts after explicit consent. Revoking consent stops the
  // existing SDK without re-importing its bundle or initializing it again.
  const { readConsent } = await import("./consent");
  analyticsAllowed = readConsent().analytics;
  if (!analyticsAllowed) {
    client?.opt_out_capturing();
    return null;
  }

  initGoogleAnalytics();
  // consent-changed and the idle callback may fire together. Import Firebase
  // only once so repeated consent notifications cannot duplicate startup work.
  if (!firebaseBootstrapStarted) {
    firebaseBootstrapStarted = true;
    void import("./firebase")
      .then((m) => {
        if (!readConsent().analytics) {
          firebaseBootstrapStarted = false;
          return null;
        }
        return m.initFirebase({ analytics: true });
      })
      .catch(() => { firebaseBootstrapStarted = false; });
  }

  if (client) {
    if (client.has_opted_out_capturing()) client.opt_in_capturing();
    return client;
  }
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"];
  if (!token) return null;
  if (initTask) return initTask;

  initTask = (async (): Promise<PostHog | null> => {
    const { default: posthog } = await import("posthog-js");
    // Consent could be revoked while the dynamic import was downloading.
    if (!readConsent().analytics) return null;
    posthog.init(token, {
      api_host: apiHost(),
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: "identified_only",
      autocapture: false,
      disable_session_recording: true,
    });
    // A previously saved PostHog opt-out must not override renewed consent.
    if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing();
    client = posthog;
    return posthog;
  })()
    .catch(() => null)
    .finally(() => { initTask = null; });
  return initTask;
}

/** Google Analytics 4 (gtag.js) — carregado apenas no navegador. */
type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

let gaId: string | null = null;

function initGoogleAnalytics() {
  if (typeof window === "undefined" || gaId) return;
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
  if (!analyticsAllowed) return;
  try {
    if (gaId) window.gtag?.("event", "page_view", { page_path: path });
  } catch {
    /* ignora: telemetria é best-effort */
  }
}

/** Registra um evento do jogo. Nunca lança: análise não pode quebrar a partida. */
export function track(event: string, props?: Record<string, string | number | boolean>) {
  if (!analyticsAllowed) return;
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
