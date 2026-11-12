/**
 * Optional remote authoritative simulation.
 *
 * OFF by default. Set MATCH_AUX_URL and MATCH_AUX_SIGNING_KEY on the
 * trusted TanStack server only after the external host and Atlas
 * static-IP allowlist are verified. No browser bundles or client state.
 */
export type AuxiliaryMatchResult = {
  hg: number;
  ag: number;
  minute: number;
  steps: number;
};

const MATCH_AUX_HOST = "matches-vps.jogomanager.com";

function safeOrigin(input: string | undefined): URL | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.hostname !== MATCH_AUX_HOST ||
      url.port ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function configured(): boolean {
  const key = process.env["MATCH_AUX_SIGNING_KEY"];
  return Boolean(safeOrigin(process.env["MATCH_AUX_URL"]) && key && key.length >= 32);
}

/** Stable per-room canary. Not an authorization boundary. */
function rolloutBucket(roomId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < roomId.length; i += 1) {
    hash = Math.imul(hash ^ roomId.charCodeAt(i), 16777619) >>> 0;
  }
  return hash % 100;
}

/**
 * Fail closed unless explicitly enabled. The canary is server-only and
 * cannot be changed by the browser. Default rollout is 0%.
 */
export function matchAuxEnabled(roomId?: string): boolean {
  if (process.env["MATCH_AUX_ENABLED"] !== "1" || !configured() || !roomId) return false;
  const percentage = Number(process.env["MATCH_AUX_ROLLOUT_PERCENT"] ?? "0");
  return (
    Number.isSafeInteger(percentage) &&
    percentage > 0 &&
    percentage <= 100 &&
    rolloutBucket(roomId) < percentage
  );
}

export async function simulateOnMatchAux(input: {
  roomId: string;
  homeClub: string;
  awayClub: string;
  seed: string;
}): Promise<AuxiliaryMatchResult> {
  const base = safeOrigin(process.env["MATCH_AUX_URL"]);
  const key = process.env["MATCH_AUX_SIGNING_KEY"];
  if (!base || !key || key.length < 32) throw new Error("match_aux_not_configured");
  const url = new URL("/v1/simulate", base);
  if (url.protocol !== "https:") throw new Error("match_aux_https_required");
  const timestamp = String(Date.now());
  const body = JSON.stringify(input);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${timestamp}.${body}`)),
  );
  const signature = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pfm-timestamp": timestamp,
      "x-pfm-signature": signature,
    },
    body,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(18_000),
  });
  if (!response.ok) throw new Error("match_aux_not_available");
  const raw: unknown = await response.json();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("match_aux_invalid_result");
  }
  const data = raw as Record<string, unknown>;
  const validInteger = (value: unknown, lower: number, upper: number): value is number =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= lower && value <= upper;
  if (
    !validInteger(data["hg"], 0, 50) ||
    !validInteger(data["ag"], 0, 50) ||
    !validInteger(data["minute"], 0, 200) ||
    !validInteger(data["steps"], 1, 100000)
  ) {
    throw new Error("match_aux_invalid_result");
  }
  return {
    hg: data["hg"],
    ag: data["ag"],
    minute: data["minute"],
    steps: data["steps"],
  };
}
