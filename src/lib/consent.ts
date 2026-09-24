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

/** Tudo que o jogo guarda neste navegador, para exportação em JSON. */
export function exportLocalData(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || k.startsWith("sb-")) continue; // sessão de login não é exportada
    const v = window.localStorage.getItem(k);
    try {
      out[k] = v ? JSON.parse(v) : v;
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export function clearLocalData() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && !k.startsWith("sb-")) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
