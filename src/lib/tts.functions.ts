import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Narração com voz realista (ElevenLabs).
 *
 * Fica no servidor porque a chave da conexão nunca pode ir para o navegador.
 * O texto é curto de propósito (frases de narração) e limitado para evitar
 * uso abusivo do endpoint público.
 */
const NarrateInput = z.object({
  text: z.string().min(1).max(220),
  voiceId: z.string().min(1).max(64).optional(),
});

/** Vozes aprovadas — evita que um cliente peça qualquer voz da conta. */
const ALLOWED_VOICES = new Set([
  "JBFqnCBsd6RMkjVDRZzb", // George
  "onwK4e9ZLuTAKqWW03F9", // Daniel
  "cjVigY5qzO86Huf0OWal", // Eric
  "EXAVITQu4vr4xnSDxMaL", // Sarah
]);

export type NarrateResult =
  | { ok: true; audio: string }
  | { ok: false; reason: "unavailable" | "error" };

export const narrateLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) return { ok: false, reason: "unavailable" };

    const voiceId =
      data.voiceId && ALLOWED_VOICES.has(data.voiceId)
        ? data.voiceId
        : "JBFqnCBsd6RMkjVDRZzb";

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_22050_32`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: data.text,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.35,
              similarity_boost: 0.8,
              style: 0.65,
              use_speaker_boost: true,
              speed: 1.05,
            },
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text();
        console.error(`ElevenLabs TTS falhou [${res.status}]: ${body}`);
        return { ok: false, reason: "error" };
      }

      const buf = await res.arrayBuffer();
      return { ok: true, audio: Buffer.from(buf).toString("base64") };
    } catch (err) {
      console.error("ElevenLabs TTS erro de rede", err);
      return { ok: false, reason: "error" };
    }
  });
