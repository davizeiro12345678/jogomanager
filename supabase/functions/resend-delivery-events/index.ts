import { readLimitedWebhookBody } from "../_shared/read-webhook-body.mjs";

// Resend delivery events. HTTPS endpoint is public; access requires a fresh,
// valid Svix/Standard-Webhooks HMAC verified over the unmodified request body.
const ORIGIN = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.failed",
  "email.bounced",
  "email.complained",
  "email.suppressed",
]);
const response = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${ORIGIN}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Webhook storage unavailable: ${res.status}`);
  return (await res.json()) as T;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, "Method not allowed");
  if (!ORIGIN || !SERVICE_ROLE) return response(503, "Webhook unavailable");
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signatures = req.headers.get("svix-signature");
  if (!id || id.length < 3 || id.length > 200 || !timestamp || !signatures)
    return response(400, "Invalid webhook headers");
  if (!/^\d{9,11}$/.test(timestamp)) return response(400, "Invalid timestamp");
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
    return response(400, "Webhook expired");
  const body = await readLimitedWebhookBody(req, 131072);
  if (body.kind === "too_large") return response(413, "Payload too large");
  if (body.kind !== "ok") return response(400, "Invalid body");
  const raw = body.text;
  let verified = false;
  try {
    const secret = await rpc<string>("jm_resend_webhook_signing_key", {});
    if (!secret || !secret.startsWith("whsec_")) return response(503, "Webhook not configured");
    const keyBytes = Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signedBody = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for (const value of signatures.split(/\s+/)) {
      if (!value.startsWith("v1,")) continue;
      try {
        const signature = Uint8Array.from(atob(value.slice(3)), (c) => c.charCodeAt(0));
        if (await crypto.subtle.verify("HMAC", key, signature, signedBody)) {
          verified = true;
          break;
        }
      } catch {
        /* Reject invalid signatures */
      }
    }
  } catch {
    return response(503, "Webhook signing configuration unavailable");
  }
  if (!verified) return response(401, "Invalid signature");
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return response(400, "Invalid JSON");
  }
  if (!event || typeof event !== "object" || Array.isArray(event))
    return response(400, "Invalid event");
  const payload = event as { type?: unknown; data?: { email_id?: unknown } | null };
  if (typeof payload.type !== "string") return response(400, "Invalid event type");
  if (!ALLOWED.has(payload.type)) return response(200, "Event ignored");
  const rawEmailId = payload.data?.email_id;
  if (rawEmailId != null && (typeof rawEmailId !== "string" || rawEmailId.length > 200))
    return response(400, "Invalid email id");
  const emailId = typeof rawEmailId === "string" ? rawEmailId : null;
  try {
    await rpc<boolean>("jm_store_resend_delivery_event", {
      p_event_id: id,
      p_event_type: payload.type,
      p_email_id: emailId,
    });
  } catch {
    return response(503, "Delivery event storage failed");
  }
  return response(200, "OK");
});
