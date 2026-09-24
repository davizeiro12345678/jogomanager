/**
 * Telemetria técnica Zero PII: só números de desempenho e dados do navegador.
 * Nunca recebe nome, e-mail, texto digitado, chat nem dados do save.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z
  .object({
    fpsAvg: z.number().min(0).max(1000).nullable(),
    frameTimeP95Ms: z.number().min(0).max(10_000).nullable(),
    browser: z.enum(["chrome", "safari", "firefox", "edge", "samsung", "outro"]),
    gpuTier: z.number().int().min(0).max(3).nullable(),
    graphicsPreset: z.enum(["alta", "media", "baixa", "auto"]).nullable(),
    loadTimeMs: z.number().int().min(0).max(600_000).nullable(),
    errorCode: z.string().regex(/^[a-z0-9_-]{1,40}$/).nullable(),
    appVersion: z.string().regex(/^[0-9a-z.-]{1,24}$/),
  })
  .strict();

export const sendTechTelemetry = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tech_telemetry").insert({
      fps_avg: data.fpsAvg,
      frame_time_p95_ms: data.frameTimeP95Ms,
      browser: data.browser,
      gpu_tier: data.gpuTier,
      graphics_preset: data.graphicsPreset,
      load_time_ms: data.loadTimeMs,
      error_code: data.errorCode,
      app_version: data.appVersion,
    });
    return { ok: true };
  });
