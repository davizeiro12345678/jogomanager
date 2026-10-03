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
      format: "mp3_44100_128",
      language: lang,
      models: narrationModels(),
      voiceSettings: settings,
    });
    return audio ? { ok: true, audio } : { ok: false, reason: "error" };
  });

type TtsModel = "eleven_v4_turbo" | "eleven_v4" | "eleven_flash_v2_5" | "eleven_multilingual_v2";

const DEFAULT_TTS_MODEL: TtsModel = "eleven_v4_turbo";
const ALLOWED_TTS_MODELS = new Set<TtsModel>([
  "eleven_v4_turbo",
  "eleven_v4",
  "eleven_flash_v2_5",
  "eleven_multilingual_v2",
]);

/** The model is server-configurable; never accept an arbitrary model ID. */
function narrationModels(): TtsModel[] {
  const configured = process.env["ELEVENLABS_TTS_MODEL"]?.trim() as TtsModel | undefined;
  const preferred =
    configured && ALLOWED_TTS_MODELS.has(configured) ? configured : DEFAULT_TTS_MODEL;
  const fallbacks: TtsModel[] = ["eleven_v4", "eleven_flash_v2_5", "eleven_multilingual_v2"];
  return [...new Set([preferred, ...fallbacks])];
}

/**
 * Chamada única ao ElevenLabs com tentativa de modelo alternativo.
 * Devolve o áudio em base64 ou `null` — o jogo sempre tem voz local de reserva.
 */
async function synthesize(opts: {
  apiKey: string;
  voiceId: string;
  text: string;
  format: string;
  language?: RemoteNarrationLang;
  models: TtsModel[];
  voiceSettings: Record<string, unknown>;
  continuity?: { previousText?: string; nextText?: string };
}): Promise<string | null> {
  const tried = new Set<string>();
  for (const model of opts.models) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      if (model === "eleven_v4_turbo") {
        const audio = await synthesizeV4Turbo(opts);
        if (audio) return audio;
        continue;
      }

      const isV4 = model === "eleven_v4";
      const endpoint = isV4
        ? `https://api.elevenlabs.io/v1/text-to-dialogue?output_format=${opts.format}`
        : `https://api.elevenlabs.io/v1/text-to-speech/${opts.voiceId}?output_format=${opts.format}`;
      const context = opts.continuity;
      const shortPrevious = context?.previousText?.slice(0, 100);
      const shortNext = context?.nextText?.slice(0, 100);
      const requestBody = isV4
        ? {
            inputs: [{ text: opts.text, voice_id: opts.voiceId }],
            model_id: model,
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

/** Eleven v4 Turbo is served through Text to Dialogue's WebSocket endpoint. */
function synthesizeV4Turbo(opts: {
  apiKey: string;
  voiceId: string;
  text: string;
  format: string;
  language?: RemoteNarrationLang;
}): Promise<string | null> {
  const url = new URL("wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input");
  url.searchParams.set("model_id", "eleven_v4_turbo");
  url.searchParams.set("output_format", opts.format);
  if (opts.language) url.searchParams.set("language_code", opts.language);

  return new Promise((resolve) => {
    const socket = new WebSocket(url.href);
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (audio: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // A socket that failed during its handshake may already be closed.
      }
      resolve(audio);
    };
    const timer = setTimeout(() => {
      finish(chunks.length ? Buffer.concat(chunks).toString("base64") : null);
    }, 6000);

    socket.addEventListener("open", () => {
      if (settled) return;
      try {
        // v4 Turbo registers exactly one voice per session. Credentials stay
        // on the server and are sent in the first frame, as the API permits.
        socket.send(JSON.stringify({ voices: [opts.voiceId], xi_api_key: opts.apiKey }));
        socket.send(
          JSON.stringify({
            inputs: [{ text: opts.text, voice_id: opts.voiceId, new_turn: true }],
          }),
        );
        // Closing flushes short match lines, which are often below the stream
        // buffer threshold, and produces the final audio frame.
        socket.send(JSON.stringify({ close_socket: true }));
      } catch (error) {
        console.error("ElevenLabs v4 Turbo envio WebSocket falhou", error);
        finish(chunks.length ? Buffer.concat(chunks).toString("base64") : null);
      }
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      const handle = (raw: string) => {
        try {
          const frame = JSON.parse(raw) as Record<string, unknown>;
          if (typeof frame["audio"] === "string") {
            chunks.push(Buffer.from(frame["audio"], "base64"));
          }
          if (frame["error"]) {
            console.error("ElevenLabs v4 Turbo retornou erro", frame["error"]);
            finish(chunks.length ? Buffer.concat(chunks).toString("base64") : null);
            return;
          }
          if (frame["is_final"] === true || frame["is_final_audio_for_turn"] === true) {
            finish(chunks.length ? Buffer.concat(chunks).toString("base64") : null);
          }
        } catch (error) {
          console.error("ElevenLabs v4 Turbo retornou quadro inválido", error);
          finish(chunks.length ? Buffer.concat(chunks).toString("base64") : null);
        }
      };

      if (typeof event.data === "string") {
        handle(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        handle(new TextDecoder().decode(event.data));
      } else if (typeof Blob !== "undefined" && event.data instanceof Blob) {
        void event.data
          .text()
          .then(handle)
          .catch(() => finish(null));
      }
    });

    socket.addEventListener("error", () => finish(null));
    socket.addEventListener("close", () => {
      finish(chunks.length ? Buffer.concat(chunks).toString("base64") : null);
    });
  });
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
      language: "pt",
      models: narrationModels(),
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

