import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  narrationLine,
  VOICE_BY_LANG,
  type NarrationEvent,
  type NarrationLang,
} from "@/game/narration-lines";
import { CUTSCENES } from "@/content/cutscenes";

/**
 * Narração da partida com voz realista (ElevenLabs).
 *
 * O cliente só escolhe idioma, evento, variação e nome do time: o texto falado
 * é montado aqui a partir de um conjunto fixo de frases. Assim o endpoint não
 * pode ser usado como TTS genérico mesmo sendo público (a partida rápida é
 * jogável sem login).
 */
const NarrateInput = z.object({
  lang: z.enum(["pt", "en", "es"]),
  event: z.enum([
    "goal",
    "save",
    "shot",
    "post",
    "foul",
    "card",
    "redCard",
    "chance",
    "corner",
    "sub",
    "kickoff",
    "halftime",
    "fulltime",
  ]),
  team: z.string().max(28).default(""),
  variant: z.number().int().min(0).max(99).default(0),
});

export type NarrateResult =
  { ok: true; audio: string } | { ok: false; reason: "unavailable" | "error" };

/** Remove qualquer coisa que não pareça um nome de clube. */
function safeTeam(raw: string): string {
  return raw.replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 28);
}

export const narrateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) return { ok: false, reason: "unavailable" };

    // Teto mensal de voz: sem saldo, o jogo cai na narração local.
    const { reserveAiBudget } = await import("@/lib/ai-budget.server");
    if (!(await reserveAiBudget("voice"))) return { ok: false, reason: "unavailable" };

    const lang = data.lang as NarrationLang;
    const event = data.event as NarrationEvent;
    const text = narrationLine(lang, event, safeTeam(data.team), data.variant);
    const voiceId = VOICE_BY_LANG[lang];
    const hype = event === "goal" || event === "save" || event === "post" || event === "redCard";

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
            text,
            // multilingual v2 entrega melhor prosódia em pt-BR e es do que turbo.
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: hype ? 0.22 : 0.4,
              similarity_boost: 0.8,
              style: hype ? 0.85 : 0.6,
              use_speaker_boost: true,
              speed: hype ? 1.12 : 1.04,
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

const SceneNarrateInput = z.object({
  scene: z.string().min(1).max(48),
  line: z.number().int().min(0).max(12),
});

/** Voz das cenas; o texto também é escolhido no servidor pelo roteiro fixo. */
export const narrateScene = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SceneNarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    const scene = CUTSCENES[data.scene];
    const text = scene?.lines[data.line]?.text;
    if (!apiKey || !text) return { ok: false, reason: "unavailable" };
    const { reserveAiBudget } = await import("@/lib/ai-budget.server");
    if (!(await reserveAiBudget("voice"))) return { ok: false, reason: "unavailable" };
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_BY_LANG.pt}?output_format=mp3_22050_32`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: scene.mood === "bad" ? 0.52 : 0.38,
              similarity_boost: 0.82,
              style: scene.mood === "good" ? 0.74 : 0.58,
              use_speaker_boost: true,
              speed: 0.98,
            },
          }),
        },
      );
      if (!res.ok) {
        console.error(`ElevenLabs cutscene TTS falhou [${res.status}]: ${await res.text()}`);
        return { ok: false, reason: "error" };
      }
      return { ok: true, audio: Buffer.from(await res.arrayBuffer()).toString("base64") };
    } catch (error) {
      console.error("ElevenLabs cutscene TTS erro de rede", error);
      return { ok: false, reason: "error" };
    }
  });
