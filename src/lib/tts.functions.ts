import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  narrationLine,
  BROADCAST_VOICE,
  broadcastRole,
  type NarrationContext,
  type NarrationEvent,
  type RemoteNarrationLang,
} from "@/game/narration-lines";
import { CUTSCENES } from "@/content/cutscenes";
import {
  FABI_VOICE_ID,
  FELIPE_VOICE_ID,
  MARIANNE_VOICE_ID,
} from "@/game/narration-voice";

/** Each cutscene speaker gets a distinct realistic Brazilian voice. */
function sceneVoice(who: string): string {
  if (who === "referee" || who === "president") return MARIANNE_VOICE_ID;
  if (who === "commentator" || who === "reporter") return FABI_VOICE_ID;
  return FELIPE_VOICE_ID;
}

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
  .validator((input: unknown) => NarrateInput.parse(input))
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
      format: "mp3_44100_128",
      language: lang,
      models: narrationModels("match"),
      voiceSettings: settings,
    });
    return audio ? { ok: true, audio } : { ok: false, reason: "error" };
  });

type TtsModel = "eleven_v4_turbo" | "eleven_v4" | "eleven_flash_v2_5" | "eleven_multilingual_v2";

const DEFAULT_TTS_MODEL: TtsModel = "eleven_v4_turbo";
type NarrationProfile = "match" | "scene";

const DEFAULT_TTS_MODEL_BY_PROFILE: Record<NarrationProfile, TtsModel> = {
  match: DEFAULT_TTS_MODEL,
  scene: "eleven_v4",
};

const TTS_MODEL_ENV_BY_PROFILE: Record<NarrationProfile, string> = {
  match: "ELEVENLABS_MATCH_TTS_MODEL",
  scene: "ELEVENLABS_SCENE_TTS_MODEL",
};

const ALLOWED_TTS_MODELS = new Set<TtsModel>([
  "eleven_v4_turbo",
  "eleven_v4",
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
]);

/** Models are server-configurable; never accept an arbitrary model ID. */
function narrationModels(profile: NarrationProfile): TtsModel[] {
  const configured = (process.env[TTS_MODEL_ENV_BY_PROFILE[profile]]?.trim() ||
    process.env["ELEVENLABS_TTS_MODEL"]?.trim()) as TtsModel | undefined;
  const preferred =
    configured && ALLOWED_TTS_MODELS.has(configured)
      ? configured
      : DEFAULT_TTS_MODEL_BY_PROFILE[profile];
  const fallbacks: Record<NarrationProfile, TtsModel[]> = {
    match: ["eleven_v4", "eleven_flash_v2_5", "eleven_multilingual_v2"],
    scene: ["eleven_v4_turbo", "eleven_multilingual_v2", "eleven_flash_v2_5"],
  };
  return [...new Set([preferred, ...fallbacks[profile]])];
}

/** Eleven v4 supports Stability and Similarity; Style and Speed are unavailable. */
function v4VoiceSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(settings["stability"] !== undefined ? { stability: settings["stability"] } : {}),
    ...(settings["similarity_boost"] !== undefined
      ? { similarity_boost: settings["similarity_boost"] }
      : {}),
  };
}

/**
 * Chamada única ao ElevenLabs com tentativa de modelo alternativo.
 * Devolve o áudio em base64 ou `null` — o jogo sempre tem voz local de reserva.
 */
type SynthOpts = {
  apiKey: string;
  voiceId: string;
  text: string;
  format: string;
  language?: RemoteNarrationLang;
  models: TtsModel[];
  voiceSettings: Record<string, unknown>;
  continuity?: { previousText?: string; nextText?: string };
};

/** Marianne requires a paid voice plan; Felipe keeps the voice realistic meanwhile. */
async function synthesize(opts: SynthOpts): Promise<string | null> {
  const audio = await synthesizeWith(opts);
  if (audio || opts.voiceId !== MARIANNE_VOICE_ID) return audio;
  return synthesizeWith({ ...opts, voiceId: FELIPE_VOICE_ID });
}

async function synthesizeWith(opts: SynthOpts): Promise<string | null> {
  const tried = new Set<string>();
  for (const model of opts.models) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      const isV4 = model === "eleven_v4";
      const isDialogueModel = isV4 || model === "eleven_v4_turbo";
      const endpoint = isDialogueModel
        ? `https://api.elevenlabs.io/v1/text-to-dialogue/stream?output_format=${opts.format}`
        : `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=${opts.format}`;
      const context = opts.continuity;
      const shortPrevious = context?.previousText?.slice(0, 100);
      const shortNext = context?.nextText?.slice(0, 100);
      const requestBody = isDialogueModel
        ? {
            inputs: [{ text: opts.text, voice_id: opts.voiceId }],
            model_id: model,
            settings: v4VoiceSettings(opts.voiceSettings),
            ...(opts.language ? { language_code: opts.language } : {}),
            ...(shortPrevious ? { previous_text: shortPrevious } : {}),
            ...(shortNext ? { future_text: shortNext } : {}),
          }
        : {
            text: opts.text,
            model_id: model,
            ...(shortPrevious ? { previous_text: shortPrevious } : {}),
            ...(shortNext ? { next_text: shortNext } : {}),
            voice_settings: opts.voiceSettings,
          };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "xi-api-key": opts.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer()).toString("base64");
      const body = await res.text();
      console.error(`ElevenLabs TTS falhou [${res.status}] (${model}): ${body}`);
      // A conta pode não ter acesso a um modelo; só esses erros avançam a cadeia.
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

/** Roberta narrates the cinematic script in Brazilian Portuguese. */
export const narrateScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SceneNarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    const scene = CUTSCENES[data.scene];
    const current = scene?.lines[data.line];
    const text = current?.text;
    if (!apiKey || !scene || !text) return { ok: false, reason: "unavailable" };
    const { reserveAiBudget } = await import("@/lib/ai-budget.server");
    if (!(await reserveAiBudget("voice"))) return { ok: false, reason: "unavailable" };

    const voiceId = sceneVoice(current.who);
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
      language: "pt",
      models: narrationModels("scene"),
      continuity: {
        ...(previousText ? { previousText } : {}),
        ...(nextText ? { nextText } : {}),
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

const PrematchNarrateInput = z.object({
  home: z.string().min(1).max(64),
  away: z.string().min(1).max(64),
  round: z.number().int().min(1).max(60),
});

/** Texto fixo da apresentação do pré-jogo; só nomes de clubes reais entram na frase. */
export function prematchIntroText(home: string, away: string, round: number): string {
  return `Boa noite, torcedor! Rodada ${round}. De um lado, ${home}. Do outro, ${away}. Estádio cheio, clima de decisão. Os times já se preparam no túnel. Vai começar!`;
}

/** Roberta apresenta o confronto no pré-jogo (ElevenLabs v4). */
export const narratePrematch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => PrematchNarrateInput.parse(input))
  .handler(async ({ data }): Promise<NarrateResult> => {
    const apiKey = process.env["ELEVENLABS_API_KEY"];
    const { CLUBS } = await import("@/game/data/leagues");
    const home = CLUBS[data.home];
    const away = CLUBS[data.away];
    if (!apiKey || !home || !away) return { ok: false, reason: "unavailable" };
    const { reserveAiBudget } = await import("@/lib/ai-budget.server");
    if (!(await reserveAiBudget("voice"))) return { ok: false, reason: "unavailable" };
    const audio = await synthesize({
      apiKey,
      voiceId: FELIPE_VOICE_ID,
      text: prematchIntroText(safeTeam(home.name), safeTeam(away.name), data.round),
      format: "mp3_44100_128",
      language: "pt",
      models: narrationModels("scene"),
      continuity: {},
      voiceSettings: { stability: 0.4, similarity_boost: 0.85, style: 0.7, use_speaker_boost: true, speed: 1.04 },
    });
    return audio ? { ok: true, audio } : { ok: false, reason: "error" };
  });
