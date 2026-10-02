import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  narrationLine,
  BROADCAST_VOICE,
  broadcastRole,
  VOICE_BY_LANG,
  type NarrationContext,
  type NarrationEvent,
  type RemoteNarrationLang,
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
  variant: z.number().int().min(0).max(1023).default(0),
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    if (!apiKey) return { ok: false, reason: "unavailable" };

    // Teto mensal de voz: sem saldo, o jogo cai na narração local.
    const { reserveAiBudget } = await import("@/lib/ai-budget.server");
    if (!(await reserveAiBudget("voice"))) return { ok: false, reason: "unavailable" };

    const lang = data.lang as RemoteNarrationLang;
    const event = data.event as NarrationEvent;
    const context: NarrationContext | undefined = data.context
      ? {
          ...(data.context.minute !== undefined ? { minute: data.context.minute } : {}),
          ...(data.context.homeGoals !== undefined ? { homeGoals: data.context.homeGoals } : {}),
          ...(data.context.awayGoals !== undefined ? { awayGoals: data.context.awayGoals } : {}),
          ...(data.context.importance ? { importance: data.context.importance } : {}),
          ...(data.context.player ? { player: safeTeam(data.context.player) } : {}),
        }
      : undefined;
    const text = narrationLine(lang, event, safeTeam(data.team), data.variant, context);
    const role = broadcastRole(event);
    const voiceId = BROADCAST_VOICE[lang][role];
    const hype = event === "goal" || event === "save" || event === "post" || event === "redCard";

    // Emoção por contexto: gol no fim de jogo apertado sai eufórico; lance
    // de rotina no meio do primeiro tempo sai contido.
    const minute = context?.minute ?? 0;
    const diff = Math.abs((context?.homeGoals ?? 0) - (context?.awayGoals ?? 0));
    const late = minute >= 80;
    const tight = diff <= 1;
    const decisive = context?.importance === "decisive" || (hype && late && tight);
    const calm = context?.importance === "routine" && !hype;

    const isReferee = role === "referee";
    const settings = {
      stability: isReferee ? 0.78 : decisive ? 0.16 : hype ? 0.26 : calm ? 0.48 : 0.4,
      similarity_boost: isReferee ? 0.9 : 0.82,
      style: isReferee ? 0.16 : decisive ? 0.95 : hype ? 0.82 : calm ? 0.45 : 0.6,
      use_speaker_boost: true,
      speed: isReferee ? 0.92 : decisive ? 1.16 : hype ? 1.1 : calm ? 0.99 : 1.04,
    };

    const audio = await synthesize({
      apiKey,
      voiceId,
      text,
      format: "mp3_44100_96",
      // Turbo v2.5 tem latência bem menor, que é o que importa no meio do
      // lance; se a conta não tiver o modelo, cai no multilíngue v2.
      models: [LIVE_MODEL, FALLBACK_MODEL],
      voiceSettings: settings,
    });
    return audio ? { ok: true, audio } : { ok: false, reason: "error" };
  });

const LIVE_MODEL = "eleven_turbo_v2_5";
const SCENE_MODEL = "eleven_multilingual_v2";
const FALLBACK_MODEL = "eleven_multilingual_v2";

/**
 * Chamada única ao ElevenLabs com tentativa de modelo alternativo.
 * Devolve o áudio em base64 ou `null` — o jogo sempre tem voz local de reserva.
 */
async function synthesize(opts: {
  apiKey: string;
  voiceId: string;
  text: string;
  format: string;
  models: string[];
  voiceSettings: Record<string, unknown>;
  extra?: Record<string, unknown>;
}): Promise<string | null> {
  const tried = new Set<string>();
  for (const model of opts.models) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=${opts.format}`,
        {
          method: "POST",
          headers: { "xi-api-key": opts.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: opts.text,
            model_id: model,
            ...(opts.extra ?? {}),
            voice_settings: opts.voiceSettings,
          }),
        },
      );
      if (res.ok) return Buffer.from(await res.arrayBuffer()).toString("base64");
      const body = await res.text();
      console.error(`ElevenLabs TTS falhou [${res.status}] (${model}): ${body}`);
      // 422/400 costuma ser modelo indisponível na conta: vale tentar o próximo.
      if (res.status !== 400 && res.status !== 422 && res.status !== 404) return null;
    } catch (err) {
      console.error("ElevenLabs TTS erro de rede", err);
      return null;
    }
  }
  return null;
}

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
  commentator: "TX3LPaxmHKxFdv7VOQHJ", // Liam — transmissão empolgada
  referee: "nPczCjzI2devNBz1zQrb", // Brian — autoridade e clareza
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
  .middleware([requireSupabaseAuth])
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
    const emphatic = current.who === "fan" || current.who === "commentator";
    const authoritative = current.who === "referee" || current.who === "president";
    const reflective = current.who === "narrator";

    const audio = await synthesize({
      apiKey,
      voiceId,
      text,
      format: "mp3_44100_128",
      models: [SCENE_MODEL, FALLBACK_MODEL],
      extra: {
        ...(previousText ? { previous_text: previousText } : {}),
        ...(nextText ? { next_text: nextText } : {}),
      },
      voiceSettings: {
        stability: authoritative
          ? 0.78
          : reflective
            ? 0.58
            : scene.mood === "bad"
              ? 0.56
              : emphatic
                ? 0.28
                : 0.46,
        similarity_boost: authoritative ? 0.9 : 0.85,
        style: authoritative
          ? 0.18
          : reflective
            ? 0.42
            : scene.mood === "good"
              ? emphatic
                ? 0.88
                : 0.62
              : 0.5,
        use_speaker_boost: true,
        speed: authoritative ? 0.92 : emphatic ? 1.08 : scene.mood === "bad" ? 0.94 : 0.99,
      },
    });
    return audio ? { ok: true, audio } : { ok: false, reason: "error" };
  });
