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
export const CONSENT_VISIBILITY_SCRIPT = `(function(){if(document.readyState!=="loading")return;try{var c=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"null");if(c&&typeof c.decidedAt==="string"){var s=document.createElement("style");s.id="pfm-consent-bootstrap";s.nonce=document.currentScript?.nonce||"";s.textContent="[data-pfm-consent-banner]{display:none!important}";document.head.appendChild(s)}}catch{}})();`;

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
