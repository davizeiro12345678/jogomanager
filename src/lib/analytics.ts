/**
 * Análise de uso (PostHog).
 *
 * Só roda no navegador e apenas quando o token público está configurado.
 * Não enviamos e-mail, nome ou qualquer dado pessoal — apenas eventos de jogo
 * (partida iniciada, carreira criada, compra concluída) e navegação.
 */
import type { PostHog } from "posthog-js/dist/module.slim.no-external.js";
import { readConsent } from "./consent";

let client: PostHog | null = null;
let starting = false;
let firebaseRequested = false;

const urlProperties = [
  "$current_url",
  "$initial_current_url",
  "$session_entry_url",
  "$session_exit_url",
  "$referrer",
  "$initial_referrer",
] as const;

function sanitizeEventUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value === "$direct") return value;
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin === window.location.origin ? url.origin + url.pathname : url.origin;
  } catch {
    return undefined;
  }
}

function apiHost() {
  const region = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_REGION"] || "eu";
  return region === "us" ? "https://us.i.posthog.com" : "https://eu.i.posthog.com";
}

export async function initAnalytics(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  // Analytics é opcional: só carrega depois do consentimento explícito.
  const allowed = readConsent().analytics;
  if (gaId) Object.assign(window, { [`ga-disable-${gaId}`]: !allowed });
  if (!allowed) {
    if (client && !client.has_opted_out_capturing()) client.opt_out_capturing();
    return null;
  }
  initGoogleAnalytics();
  if (!firebaseRequested) {
    firebaseRequested = true;
    void import("./firebase")
      .then(async (module) => {
        if (readConsent().analytics && (await module.initFirebase({ analytics: true }))) return;
        firebaseRequested = false;
      })
      .catch(() => {
        firebaseRequested = false;
      });
  }
  if (client) {
    if (client.has_opted_out_capturing()) client.opt_in_capturing();
    return client;
  }
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY"];
  if (!token || starting) return null;
  starting = true;
  try {
    // Explicit event capture needs only the bundled core, without remote feature code.
    const { default: posthog } = await import("posthog-js/dist/module.slim.no-external.js");
    if (!readConsent().analytics) return null;
    posthog.init(token, {
      api_host: apiHost(),
      capture_pageview: "history_change",
      capture_pageleave: true,
      person_profiles: "never",
      autocapture: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_web_experiments: true,
      advanced_disable_flags: true,
      disable_capture_url_hashes: true,
      before_send(event) {
        if (!event || !readConsent().analytics) return null;
        for (const key of urlProperties) {
          if (!(key in event.properties)) continue;
          const sanitized = sanitizeEventUrl(event.properties[key]);
          if (sanitized) event.properties[key] = sanitized;
          else delete event.properties[key];
        }
        return event;
      },
    });
    client = posthog;
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
  if (!readConsent().analytics) return;
  try {
    if (gaId) window.gtag?.("event", "page_view", { page_path: path });
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
