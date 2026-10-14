/**
 * Optional client performance samples are self-reported and never authoritative
 * Lighthouse/Core Web Vitals or benchmark data. Account IDs are retained for\n * abuse control; no names, emails or saves are collected. No privileged writes.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifiedAccount } from "./verified-identity.server";

const schema = z
  .object({
    fpsAvg: z.number().min(0).max(1000).nullable(),
    frameTimeP95Ms: z.number().min(0).max(10_000).nullable(),
    browser: z.enum(["chrome", "safari", "firefox", "edge", "samsung", "outro"]),
    gpuTier: z.number().int().min(0).max(3).nullable(),
    graphicsPreset: z.enum(["alta", "media", "baixa", "auto"]).nullable(),
    loadTimeMs: z.number().int().min(0).max(600_000).nullable(),
    errorCode: z
      .string()
      .regex(/^[a-z0-9_-]{1,40}$/)
      .nullable(),
    appVersion: z.string().regex(/^[0-9a-z.-]{1,24}$/),
  })
  .strict();

export const sendTechTelemetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    // A JWT with an unverified email must not qualify for telemetry submission.
    // Supabase checks the actual Auth user and email confirmation independently.
    const user = await verifiedAccount(context.supabase, context.userId);
    if (!user) return { ok: false, reason: "verification_required" as const };

    // Scoped JWT client, never supabaseAdmin/service_role: the RLS policy
    // permits only an own, explicitly untrusted sample once per UTC hour.
    const { error } = await context.supabase.from("tech_telemetry").insert({
      user_id: user.id,
      fps_avg: data.fpsAvg,
      frame_time_p95_ms: data.frameTimeP95Ms,
      browser: data.browser,
      gpu_tier: data.gpuTier,
      graphics_preset: data.graphicsPreset,
      load_time_ms: data.loadTimeMs,
      error_code: data.errorCode,
      app_version: data.appVersion,
    });
    if (error?.code === "23505") return { ok: false, reason: "rate_limited" as const };
    if (error) return { ok: false, reason: "unavailable" as const };
    return { ok: true, origin: "client_unverified" as const };
  });
