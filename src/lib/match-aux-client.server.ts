/**
 * Server-only transport for the canonical VPS match engine.
 *
 * The TanStack server owns the room, private seed, settlement lease, final
 * write and RLS enforcement. The VPS only simulates the authenticated
 * server-to-server request and returns its deterministic result.
 *
 * Rollout: set MATCH_AUX_ENABLED=1, MATCH_AUX_URL to the dedicated Cloudflare
 * Tunnel hostname, and MATCH_AUX_SIGNING_KEY as a server-only secret.
 * Without an explicit rollout flag, preserve the existing optional
 * MATCH_AUX_URL behavior for older deployments.
 */
export type AuxiliaryMatchResult = {
  hg: number;
  ag: number;
  minute: number;
  steps: number;
};

const VPS_MATCH_HOST = "matches-vps.jogomanager.com";
const MAX_ATTEMPTS = 8;
const TIME_BUDGET_MS = 18_000;
const BUSY_RETRY_MS = [150, 250, 350, 500, 750, 1_000, 1_500] as const;

function configuredOrigin(): URL | null {
  const enabled = process.env["MATCH_AUX_ENABLED"];
  if (enabled === "0" || (enabled !== undefined && enabled !== "1")) return null;
  const input = process.env["MATCH_AUX_URL"]?.trim();
  const key = process.env["MATCH_AUX_SIGNING_KEY"];
  if (!input || !key || key.length < 32) return null;

  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      (url.pathname !== "" && url.pathname !== "/") ||
      (enabled === "1" && url.hostname !== VPS_MATCH_HOST)
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** A missing signing secret must never enable the production remote path. */
export function matchAuxEnabled(): boolean {
  return configuredOrigin() !== null;
}

function parseResult(raw: unknown): AuxiliaryMatchResult {
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
  return { hg: data["hg"], ag: data["ag"], minute: data["minute"], steps: data["steps"] };
}

export async function simulateOnMatchAux(input: {
  roomId: string;
  homeClub: string;
  awayClub: string;
  seed: string;
}): Promise<AuxiliaryMatchResult> {
  const origin = configuredOrigin();
  const key = process.env["MATCH_AUX_SIGNING_KEY"];
  if (!origin || !key) throw new Error("match_aux_not_configured");

  const url = new URL("/v1/simulate", origin);
  const body = JSON.stringify(input);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const deadline = Date.now() + TIME_BUDGET_MS;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("match_aux_timeout");

    // Re-sign on every retry. Never reuse an expiring HMAC timestamp.
    const timestamp = String(Date.now());
    const signatureBytes = new Uint8Array(
      await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${timestamp}.${body}`)),
    );
    const signature = Array.from(signatureBytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pfm-timestamp": timestamp,
        "x-pfm-signature": signature,
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(remaining),
    });

    if (!response.ok) {
      if ((response.status === 429 || response.status === 409) && attempt < MAX_ATTEMPTS - 1) {
        const failure: unknown = await response.json().catch(() => null);
        const reason =
          failure && typeof failure === "object" && !Array.isArray(failure)
            ? (failure as Record<string, unknown>)["error"]
            : null;
        if (reason === "server_busy" || reason === "room_in_progress") {
          const pause = Math.min(BUSY_RETRY_MS[attempt] ?? 1_500, deadline - Date.now());
          if (pause > 0) await new Promise<void>((resolve) => setTimeout(resolve, pause));
          continue;
        }
      }
      throw new Error("match_aux_not_available");
    }

    return parseResult(await response.json());
  }
  throw new Error("match_aux_busy");
}
