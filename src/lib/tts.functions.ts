import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  narrationLine,
  VOICE_BY_LANG,
  type NarrationContext,
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
  context: z
    .object({
      minute: z.number().int().min(0).max(120).optional(),
      homeGoals: z.number().int().min(0).max(99).optional(),
      awayGoals: z.number().int().min(0).max(99).optional(),
      player: z.string().max(36).optional(),
      importance: z.enum(["routine", "pressure", "decisive"]).optional(),
    })
    .optional(),
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
    const context: NarrationContext | undefined = data.context
      ? { ...data.context, player: data.context.player ? safeTeam(data.context.player) : undefined }
      : undefined;
    const text = narrationLine(lang, event, safeTeam(data.team), data.variant, context);
    const voiceId = VOICE_BY_LANG[lang];
    const hype = event === "goal" || event === "save" || event === "post" || event === "redCard";

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
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

/**
 * Voz por papel na cena: cada personagem fala com um timbre diferente, o que
 * dá variedade e realismo à encenação. O texto continua vindo do roteiro fixo.
 */
const SCENE_VOICE: Record<string, string> = {
  narrator: "JBFqnCBsd6RMkjVDRZzb", // George — locução
  manager: "onwK4e9ZLuTAKqWW03F9", // Daniel — firme
  president: "nPczCjzI2devNBz1zQrb", // Brian — grave
  press: "cgSgspJ2msm6clMCkdW9", // Jessica — repórter
  captain: "bIHbv24MWmeRgasZH58o", // Will — jovem
  assistant: "cjVigY5qzO86Huf0OWal", // Eric
  doctor: "pFZP5JQG7iQjIQuC4Bku", // Lily
  scout: "N2lVS1w4EtoT3dr4eOWO", // Callum
  agent: "iP95p4xoKVk53GoZ742B", // Chris
  fan: "TX3LPaxmHKxFdv7VOQHJ", // Liam — empolgado
};

export const narrateScene = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SceneNarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    const scene = CUTSCENES[data.scene];
    const current = scene?.lines[data.line];
    const text = current?.text;
    if (!apiKey || !scene || !text) return { ok: false, reason: "unavailable" };
    const { reserveAiBudget } = await import("@/lib/ai-budget.server");
    if (!(await reserveAiBudget("voice"))) return { ok: false, reason: "unavailable" };

    const voiceId = SCENE_VOICE[current.who] ?? VOICE_BY_LANG.pt;
    // contexto das falas vizinhas: mantém a prosódia contínua entre linhas
    const previousText = scene.lines[data.line - 1]?.text;
    const nextText = scene.lines[data.line + 1]?.text;
    const emphatic = current.who === "fan" || current.who === "narrator";

    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            ...(previousText ? { previous_text: previousText } : {}),
            ...(nextText ? { next_text: nextText } : {}),
            voice_settings: {
              stability: scene.mood === "bad" ? 0.58 : emphatic ? 0.34 : 0.46,
              similarity_boost: 0.85,
              style: scene.mood === "good" ? (emphatic ? 0.8 : 0.62) : 0.5,
              use_speaker_boost: true,
              speed: scene.mood === "bad" ? 0.94 : 0.99,
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
