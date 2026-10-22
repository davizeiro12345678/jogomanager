// Supabase Auth Send SMS HTTP Hook, staged but deliberately disabled.
// Requires a signed Standard Webhooks request, Twilio Verify CustomCode,
// Fraud Guard and Geo Permissions configured at the Twilio service,
// a server-only HMAC secret, and service-role-only database quota.
// NO AUTH HOOK IS ENABLED BY DEPLOYING THIS FUNCTION.
const E164 = /^\+[1-9]\d{7,14}$/;
const SID = /^AC[0-9a-fA-F]{32}$/;
const VERIFY_SID = /^VA[0-9a-fA-F]{32}$/;
const HEX = /^[0-9a-f]{64}$/;
const MAX_BYTES = 20_000;

function reply(status: number, reason: string) {
  return new Response(reason, {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function config() {
  return {
    active: Deno.env.get("ENABLE_TWILIO_SMS_HOOK") === "true",
    signing: Deno.env.get("SEND_SMS_HOOK_SECRETS") ?? "",
    account: Deno.env.get("TWILIO_ACCOUNT_SID") ?? "",
    token: Deno.env.get("TWILIO_AUTH_TOKEN") ?? "",
    verify: Deno.env.get("TWILIO_VERIFY_SERVICE_SID") ?? "",
    pepper: Deno.env.get("PHONE_OTP_HMAC_SECRET") ?? "",
    supabase: Deno.env.get("SUPABASE_URL") ?? "",
    serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

async function checkSignature(
  raw: string,
  id: string,
  stamp: string,
  advertised: string,
): Promise<boolean> {
  const signed = new TextEncoder().encode(`${id}.${stamp}.${raw}`);
  const provided = advertised.split(/\s+/).filter((v) => v.startsWith("v1,"));
  for (const entry of (Deno.env.get("SEND_SMS_HOOK_SECRETS") ?? "").split("|")) {
    const b64 = entry.startsWith("v1,whsec_")
      ? entry.slice("v1,whsec_".length)
      : entry.startsWith("whsec_")
        ? entry.slice("whsec_".length)
        : "";
    if (!b64) continue;
    try {
      const keyBytes = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      for (const signature of provided) {
        const hash = Uint8Array.from(atob(signature.slice(3)), (x) => x.charCodeAt(0));
        if (await crypto.subtle.verify("HMAC", key, hash, signed)) return true;
      }
    } catch {
      // Invalid encoding or signature is never considered authenticated.
    }
  }
  return false;
}

async function hashed(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
  const output = Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");
  if (!HEX.test(output)) throw new Error("Invalid HMAC");
  return output;
}

async function spendBudget(
  url: string,
  key: string,
  phoneHmac: string,
  aggregateHmac: string,
  channel: string,
) {
  const res = await fetch(`${url}/rest/v1/rpc/jm_consume_sms_hook_budget`, {
    method: "POST",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_phone_hmac: phoneHmac,
      p_global_hmac: aggregateHmac,
      p_channel: channel,
    }),
    signal: AbortSignal.timeout(1200),
  });
  if (!res.ok) throw new Error("Rate limiter unavailable");
  const rows: unknown = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error("Invalid budget response");
  const allowed = (rows[0] as { allowed?: unknown }).allowed === true;
  return allowed;
}

async function sendViaVerify(
  service: string,
  account: string,
  token: string,
  phone: string,
  otp: string,
  channel: "sms" | "whatsapp",
) {
  const endpoint = `https://verify.twilio.com/v2/Services/${service}/Verifications`;
  const body = new URLSearchParams({
    To: phone,
    Channel: channel,
    CustomCode: otp,
    RiskCheck: "enable",
  });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${account}:${token}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`Verify provider failed: HTTP ${res.status}`);
  const response: { status?: string } = await res.json();
  if (response.status !== "pending") throw new Error("Unexpected Verify response");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, "{}");
  const env = config();
  // An explicit enable switch prevents accidental real sends even if a secret
  // from another project was copied here. Do not log OTP, phone or secrets.
  if (!env.active) return reply(503, "{}");
  if (
    !SID.test(env.account) ||
    !VERIFY_SID.test(env.verify) ||
    !env.token ||
    !env.signing ||
    env.pepper.length < 32 ||
    !env.supabase.startsWith("https://") ||
    !env.serviceRole
  )
    return reply(503, "{}");

  const id = request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";
  const signature = request.headers.get("webhook-signature") ?? "";
  if (!id || id.length > 200 || !/^\d{9,12}$/.test(timestamp) || !signature)
    return reply(400, "{}");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return reply(400, "{}");
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(contentLength) || contentLength > MAX_BYTES) return reply(413, "{}");
  const raw = await request.text().catch(() => null);
  if (raw === null || new TextEncoder().encode(raw).byteLength > MAX_BYTES) return reply(413, "{}");
  if (!(await checkSignature(raw, id, timestamp, signature))) return reply(401, "{}");

  let event: { user?: { phone?: string }; sms?: { otp?: string; channel?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return reply(400, "{}");
  }
  const phone = event.user?.phone ?? "";
  const otp = event.sms?.otp ?? "";
  // The documented Send SMS hook does not reliably include the original
  // requested channel. Default to SMS, never trust a request header.
  const channel: "sms" | "whatsapp" = event.sms?.channel === "whatsapp" ? "whatsapp" : "sms";
  if (!E164.test(phone) || !/^\d{4,10}$/.test(otp)) return reply(400, "{}");

  try {
    const phoneHash = await hashed(env.pepper, `phone:${phone}`);
    // The hook does NOT have a trusted client IP. A fixed server-side hash
    // intentionally enforces an aggregate max of 15 OTP sends/hour,
    // shared with both messaging channels. Do not advertise this as IP-rate limit.
    const globalHash = await hashed(env.pepper, "hook:shared-global-quota");
    const allowed = await spendBudget(
      env.supabase,
      env.serviceRole,
      phoneHash,
      globalHash,
      channel,
    );
    if (!allowed) return reply(429, "{}");
    await sendViaVerify(env.verify, env.account, env.token, phone, otp, channel);
    return reply(200, "{}");
  } catch {
    return reply(503, "{}");
  }
});
