import config from "./ads.config.json";

export type AdPlacement = "feed" | "inventory" | "sidebar" | "corner" | "native";
export type AdContext =
  | "dashboard"
  | "squad"
  | "tactics"
  | "transfers"
  | "news"
  | "match"
  | "postmatch"
  | "profile"
  | "store";

export interface AdCampaign {
  id: string;
  brand: string;
  title: string;
  body: string;
  label: string;
  cta: string;
  href: string;
  contexts: AdContext[];
  placements: AdPlacement[];
  priority: number;
  kind: "own" | "partner";
}

export interface AdMetric {
  campaignId: string;
  placement: AdPlacement;
  type: "impression" | "click" | "dismiss" | "conversion";
  at: number;
}

const SESSION_KEY = "manager3d.ads.session.v1";
const HISTORY_KEY = "manager3d.ads.history.v1";
const METRICS_KEY = "manager3d.ads.metrics.v1";
const SESSION_CAP = 3;
const COOLDOWN_MS = 5 * 60 * 1000;
const campaigns = config.campaigns as AdCampaign[];

interface SessionState {
  views: Record<string, number>;
  dismissedAt: Partial<Record<AdPlacement, number>>;
  interactions: string[];
}

function readJson<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sessionState(): SessionState {
  if (typeof sessionStorage === "undefined")
    return { views: {}, dismissedAt: {}, interactions: [] };
  return readJson(sessionStorage, SESSION_KEY, { views: {}, dismissedAt: {}, interactions: [] });
}

function saveSession(state: SessionState) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* A publicidade própria continua funcional sem persistência. */
  }
}

export function selectAd(context: AdContext, placement: AdPlacement): AdCampaign | null {
  const state = sessionState();
  const dismissed = state.dismissedAt[placement] ?? 0;
  if (Date.now() - dismissed < COOLDOWN_MS) return null;
  const history =
    typeof localStorage === "undefined" ? [] : readJson<string[]>(localStorage, HISTORY_KEY, []);
  const eligible = campaigns
    .filter((ad) => ad.contexts.includes(context) && ad.placements.includes(placement))
    .filter((ad) => (state.views[ad.id] ?? 0) < SESSION_CAP)
    .sort((a, b) => {
      const aAffinity = state.interactions.includes(a.id) || history.includes(a.id) ? 2 : 0;
      const bAffinity = state.interactions.includes(b.id) || history.includes(b.id) ? 2 : 0;
      return b.priority + bAffinity - (a.priority + aAffinity);
    });
  return eligible[0] ?? null;
}

export function recordAdMetric(campaignId: string, placement: AdPlacement, type: AdMetric["type"]) {
  if (typeof window === "undefined") return;
  const state = sessionState();
  if (type === "impression") state.views[campaignId] = (state.views[campaignId] ?? 0) + 1;
  if (type === "dismiss") state.dismissedAt[placement] = Date.now();
  if (type === "click" && !state.interactions.includes(campaignId))
    state.interactions.push(campaignId);
  saveSession(state);
  try {
    const metrics = readJson<AdMetric[]>(localStorage, METRICS_KEY, []);
    metrics.push({ campaignId, placement, type, at: Date.now() });
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics.slice(-500)));
    if (type === "click") {
      const history = readJson<string[]>(localStorage, HISTORY_KEY, []);
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify([campaignId, ...history.filter((id) => id !== campaignId)].slice(0, 30)),
      );
    }
  } catch {
    /* Métricas são opcionais e nunca impedem a navegação. */
  }
  void import("@/lib/analytics").then(({ track }) =>
    track(`ad_${type}`, { campaign: campaignId, placement }),
  );
}

export function getAdMetrics(): AdMetric[] {
  if (typeof localStorage === "undefined") return [];
  return readJson<AdMetric[]>(localStorage, METRICS_KEY, []);
}
