/** Snapshot only application keys; auth sessions are never exported or cleared. */
function gameDataKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && !key.startsWith("sb-")) keys.push(key);
  }
  return keys;
}

/** Tudo que o jogo guarda neste navegador, para exportação em JSON. */
export function exportLocalData(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of gameDataKeys()) {
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
  gameDataKeys().forEach((key) => window.localStorage.removeItem(key));
  window.dispatchEvent(new CustomEvent("consent-changed"));
}
