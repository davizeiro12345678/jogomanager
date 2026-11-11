import type { SupportInput, SupportResult } from "./support-input";

interface SupportConfiguration {
  url: string;
  secret: string;
}
export interface SupportReservation {
  status: "leased" | "sent" | "pending" | "conflict" | "rate_limited" | "unavailable";
  leaseToken?: string;
  createdAt?: string;
  payload?: { email: string; category: string; message: string };
}
export interface SupportStore {
  reserve(
    userId: string,
    requestId: string,
    hash: string,
    payload: {
      email: string;
      category: string;
      message: string;
    },
  ): Promise<SupportReservation>;
  finish(
    userId: string,
    requestId: string,
    leaseToken: string,
    delivered: boolean,
  ): Promise<boolean>;
}

export function readSupportConfiguration(): SupportConfiguration | null {
  if (process.env["SUPPORT_WEBHOOK_ENABLED"] !== "true") return null;
  const url = process.env["SUPPORT_WEBHOOK_URL"]?.trim();
  const secret = process.env["SUPPORT_WEBHOOK_SECRET"];
  if (!url || url.length > 2048 || !secret || secret.length < 32 || secret.length > 512)
    return null;
  if (secret.includes("\r") || secret.includes("\n") || secret.includes("\0")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash)
      return null;
  } catch {
    return null;
  }
  if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) return null;
  return { url, secret };
}

const bytes = new TextEncoder();
function hex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
export async function supportPayloadHash(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", bytes.encode(value)));
}
export async function signSupportWebhook(
  secret: string,
  timestamp: string,
  eventId: string,
  body: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return `v1=${hex(await crypto.subtle.sign("HMAC", key, bytes.encode(`${timestamp}.${eventId}.${body}`)))}`;
}

/** At-least-once transport. The receiver must deduplicate the stable event ID. */
export async function dispatchSupportRequest(
  input: SupportInput,
  user: { id: string; email: string },
  store: SupportStore,
  options: {
    configuration?: SupportConfiguration | null;
    fetch?: typeof fetch;
    now?: () => number;
  } = {},
): Promise<SupportResult> {
  const configuration =
    options.configuration === undefined ? readSupportConfiguration() : options.configuration;
  if (!configuration || input.website) return { ok: false, reason: "unavailable" };
  const payload = { email: user.email, category: input.category, message: input.message };
  try {
    const hash = await supportPayloadHash(JSON.stringify(payload));
    const reservation = await store.reserve(user.id, input.requestId, hash, payload);
    if (reservation.status === "sent") return { ok: true, requestId: input.requestId };
    if (reservation.status !== "leased") return { ok: false, reason: reservation.status };
    if (!reservation.leaseToken || !reservation.createdAt || !reservation.payload)
      return { ok: false, reason: "unavailable" };
    const eventId = `support:${user.id}:${input.requestId}`;
    const body = JSON.stringify({
      type: "support.requested",
      version: 1,
      id: eventId,
      userId: user.id,
      createdAt: reservation.createdAt,
      ...reservation.payload,
    });
    const timestamp = String(Math.floor((options.now ?? Date.now)() / 1000));
    const signature = await signSupportWebhook(configuration.secret, timestamp, eventId, body);
    let delivered = false;
    try {
      const response = await (options.fetch ?? fetch)(configuration.url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": eventId,
          "X-JogoManager-Event-Id": eventId,
          "X-JogoManager-Timestamp": timestamp,
          "X-JogoManager-Signature": signature,
        },
        body,
      });
      delivered = response.ok;
      await response.body?.cancel();
    } catch {
      // A timeout can follow acceptance. Keep the same ID for a later retry.
    }
    const recorded = await store.finish(
      user.id,
      input.requestId,
      reservation.leaseToken,
      delivered,
    );
    return delivered && recorded
      ? { ok: true, requestId: input.requestId }
      : { ok: false, reason: "unavailable" };
  } catch {
    // Never expose endpoint URLs, tokens, SQL details or private messages in errors/logs.
    return { ok: false, reason: "unavailable" };
  }
}
