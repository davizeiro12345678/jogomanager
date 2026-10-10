/**
 * Telemetria técnica Zero PII: só números de desempenho e dados do navegador.
 * Nunca recebe nome, e-mail, texto digitado, chat nem dados do save.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TELEMETRY_BUCKET_PREFIX = "tech-v1:";

/** Pseudonymous request bucket. The raw address never reaches the database,
 * telemetry row, logs, or browser; a server-only salt makes the hash useless
 * outside this runtime. */
export async function telemetryRateLimitBucket(
  headers: Headers,
  salt: string | undefined,
): Promise<string | null> {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = headers.get("cf-connecting-ip")?.trim() || forwarded;
  const hasControlCharacter =
    address &&
    Array.from(address).some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    });
  if (!salt || !address || address.length > 64 || hasControlCharacter) {
    return null;
  }

  const bytes = new TextEncoder().encode(`${salt}\u0000${address}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `${TELEMETRY_BUCKET_PREFIX}${hash}`;
}

function telemetryRateLimitSalt(): string | undefined {
  // The service credential is already required to create the admin client and
  // never leaves this module. A dedicated salt can replace it at deployment.
  return process.env["TELEMETRY_RATE_LIMIT_SALT"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
}

/**
 * The standalone graphics fixture and a browser bundle must never pull a
 * server request implementation (or an admin client) into their graph.  The
 * Start runtime evaluates this branch only on the server; every other caller
 * fails closed before any telemetry persistence is attempted.
 */
async function serverRequest(): Promise<Request | undefined> {
  if (!import.meta.env.SSR) return undefined;
  const { getRequest } = await import("@tanstack/react-start/server");
  return getRequest();
}

const schema = z
  .object({
    fpsAvg: z.number().finite().min(0).max(1000).nullable(),
    frameTimeP95Ms: z.number().finite().min(0).max(10_000).nullable(),
    browser: z.enum(["chrome", "safari", "firefox", "edge", "samsung", "outro"]),
    gpuTier: z.number().finite().int().min(0).max(3).nullable(),
    graphicsPreset: z.enum(["alta", "media", "baixa", "auto"]).nullable(),
    loadTimeMs: z.number().finite().int().min(0).max(600_000).nullable(),
    errorCode: z
      .string()
      .regex(/^[a-z0-9_-]{1,40}$/)
      .nullable(),
    appVersion: z.string().regex(/^[0-9a-z.-]{1,24}$/),
  })
  .strict();

export const sendTechTelemetry = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const request = await serverRequest();
    const bucket = request
      ? await telemetryRateLimitBucket(request.headers, telemetryRateLimitSalt())
      : null;
    // Performance diagnostics are optional. Fail closed instead of accepting
    // anonymous writes when a trusted request fingerprint is unavailable.
    if (!bucket) return { ok: false };

    if (!import.meta.env.SSR) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admitted, error: limitError } = await supabaseAdmin.rpc(
      "reserve_tech_telemetry_slot",
      { _bucket: bucket },
    );
    if (limitError || admitted !== true) return { ok: false };

    const { error } = await supabaseAdmin.from("tech_telemetry").insert({
      fps_avg: data.fpsAvg,
      frame_time_p95_ms: data.frameTimeP95Ms,
      browser: data.browser,
      gpu_tier: data.gpuTier,
      graphics_preset: data.graphicsPreset,
      load_time_ms: data.loadTimeMs,
      error_code: data.errorCode,
      app_version: data.appVersion,
    });
    return { ok: !error };
  });
