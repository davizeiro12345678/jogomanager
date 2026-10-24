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

function configured(): boolean {
  return Boolean(process.env["MATCH_AUX_URL"]?.trim());
}

export function matchAuxEnabled(): boolean {
  return configured();
}

export async function simulateOnMatchAux(input: {
  roomId: string;
  homeClub: string;
  awayClub: string;
  seed: string;
}): Promise<AuxiliaryMatchResult> {
  const base = process.env["MATCH_AUX_URL"];
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
    signal: AbortSignal.timeout(18_000),
  });
  if (!response.ok) throw new Error("match_aux_not_available");
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("hg" in result) ||
    !("ag" in result) ||
    !("minute" in result) ||
    !("steps" in result) ||
    ![result.hg, result.ag, result.minute, result.steps].every(
      (value) => typeof value === "number" && Number.isSafeInteger(value),
    ) ||
    result.hg < 0 ||
    result.ag < 0 ||
    result.hg > 50 ||
    result.ag > 50 ||
    result.minute < 0 ||
    result.minute > 200 ||
    result.steps < 1 ||
    result.steps > 100000
  ) {
    throw new Error("match_aux_invalid_result");
  }
  return result as AuxiliaryMatchResult;
}
