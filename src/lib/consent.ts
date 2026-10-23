/**
 * Consentimento do usuário (fica só neste navegador). Dados essenciais são
 * sempre ativos; analytics e telemetria técnica são opcionais e revogáveis.
 */
export interface ConsentState {
  analytics: boolean;
  telemetry: boolean;
  decidedAt: string | null;
}

const KEY = "pfm-consent-v1";
const DEFAULT: ConsentState = { analytics: false, telemetry: false, decidedAt: null };

// Only visibility is bootstrapped. This never writes a decision or enables an
// optional SDK. A separate style node avoids mutating React's hydrated markup;
// the trusted head script carries its CSP nonce onto the generated style.
// HeadContent replays scripts after hydration, when this parser-only rule must
// stay removed so a later reset/remount can show the question normally.
export const CONSENT_VISIBILITY_SCRIPT = `(function(){if(document.readyState!=="loading")return;try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"null");if(c&&typeof c.decidedAt==="string"){var s=document.createElement("style");s.id="pfm-consent-bootstrap";s.nonce=document.currentScript?document.currentScript.nonce:"";s.textContent="[data-pfm-consent-banner]{display:none!important}";document.head.appendChild(s)}}catch{}})();`;

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<ConsentState>;
    return {
      analytics: v.analytics === true,
      telemetry: v.telemetry === true,
      decidedAt: typeof v.decidedAt === "string" ? v.decidedAt : null,
    };
  } catch {
    return DEFAULT;
  }
}

export function saveConsent(next: Omit<ConsentState, "decidedAt">): ConsentState {
  const state = { ...next, decidedAt: new Date().toISOString() };
  window.localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("consent-changed", { detail: state }));
  return state;
}

/** Explicit browser preferences only; never enumerate arbitrary application/provider data. */
const PUBLIC_GAME_PREFERENCES = new Set([
  KEY,
  "jogomanager.lang",
  "pfm3d.lang",
  "manager3d.visual.v3",
  "manager3d.accessibility.v1",
  "manager3d.career-density",
  "manager3d.recent-navigation.v1",
  "manager3d.ceremony",
  "manager3d.prematchIntro",
  "manager3d.officialLook",
]);

export function canAccessCareerMirror(key: string, owner: string | null = null): boolean {
  if (PUBLIC_GAME_PREFERENCES.has(key)) return true;
  if (
    key === "manager3d.career.v1" ||
    key === "pfm.player-career.v1" ||
    /^manager3d\.athlete\.v1\.[1-3]$/.test(key)
  )
    return owner === null;
  if (key.startsWith("manager3d.career.v1:user:")) {
    return owner !== null && key === `manager3d.career.v1:user:${encodeURIComponent(owner)}`;
  }
  const scope = owner ? `user:${encodeURIComponent(owner)}` : "guest";
  const slotPrefixes = [
    "manager3d.athlete.v2",
    "manager3d.athlete.envelope.v1",
    "manager3d.athlete.backup.v1",
    "manager3d.athlete.conflict-backup.v1",
  ];
  if (slotPrefixes.some((prefix) => [1, 2, 3].some((slot) => key === `${prefix}.${scope}.${slot}`)))
    return true;
  return [
    "manager3d.athlete.index.v1",
    "manager3d.athlete.outbox.v1",
    "manager3d.athlete.cloud-revisions.v1",
  ].some((prefix) => key === `${prefix}.${scope}`);
}

export async function exportLocalData(
  owner: string | null = null,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || k.startsWith("sb-") || !canAccessCareerMirror(k, owner)) continue; // sessão de login não é exportada
    const v = window.localStorage.getItem(k);
    try {
      out[k] = v ? JSON.parse(v) : v;
    } catch {
      out[k] = v;
    }
  }
  const { exportLocalCareerData } = await import("@/lib/offline/store");
  const { exportReplayArchive } = await import("@/game/replay-storage");
  out["offlineCareer"] = await exportLocalCareerData(owner);
  // The replay store admits global historical archives for guests only.
  out["localReplayArchive"] = await exportReplayArchive(owner);
  return out;
}

export async function clearLocalData(owner: string | null = null): Promise<boolean> {
  let indexedDbDataCleared: boolean;
  try {
    const [{ clearLocalCareerData }, { clearReplayArchive }, { clearVoiceCache }] =
      await Promise.all([
        import("@/lib/offline/store"),
        import("@/game/replay-storage"),
        import("@/game/audio-cache"),
      ]);
    const results = await Promise.all([
      clearLocalCareerData(owner),
      clearReplayArchive(owner),
      ...(owner === null ? [clearVoiceCache()] : []),
    ]);
    indexedDbDataCleared = results.every(Boolean);
  } catch {
    indexedDbDataCleared = false;
  }
  const keys: string[] = [];
  let localStorageCleared = true;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && !k.startsWith("sb-") && canAccessCareerMirror(k, owner)) keys.push(k);
  }
  try {
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    localStorageCleared = false;
  }
  return indexedDbDataCleared && localStorageCleared;
}
