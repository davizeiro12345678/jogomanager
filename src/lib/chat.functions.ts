import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePublicText, hasVisibleText } from "./untrusted-json";
import { MODERATION_MESSAGES, moderateMessage, type ModerationReason } from "./moderation";
import { INFRACTION_WINDOW_MS, muteUntil } from "./chat-penalties";
import { notifyUsers, MAX_TOKENS_PER_EVENT } from "./push.server";

const SendMessageInput = z
  .object({
    body: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(1).max(500))
      .refine(hasVisibleText),
  })
  .strict();

/** Recent own messages checked by the repeat rule. */
const REPEAT_LOOKBACK = 3;

export type SendMessageResult =
  | { ok: true; id: string }
  | { ok: false; reason: "rate_limited" | "invalid_length" | "error" }
  | { ok: false; reason: "blocked"; rule: ModerationReason; message: string }
  | { ok: false; reason: "muted"; until: string | null; message: string };

function mutedMessage(until: number): string {
  if (!Number.isFinite(until)) return "Seu acesso ao chat foi bloqueado por infrações repetidas.";
  const minutes = Math.ceil((until - Date.now()) / 60_000);
  const span = minutes >= 120 ? `${Math.ceil(minutes / 60)} horas` : `${minutes} minutos`;
  return `Você está silenciado no chat por infrações repetidas. Tente de novo em ${span}.`;
}

/**
 * Envio de mensagem no chat global. A identidade vem do token verificado no
 * servidor; a moderação roda aqui e não pode ser desligada pelo navegador.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SendMessageInput.parse(input))
  .handler(async ({ data, context }): Promise<SendMessageResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - INFRACTION_WINDOW_MS).toISOString();

    const [infractions, recent] = await Promise.all([
      supabaseAdmin
        .from("chat_infractions")
        .select("created_at")
        .eq("user_id", context.userId)
        .gte("created_at", since),
      supabaseAdmin
        .from("chat_messages")
        .select("body")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(REPEAT_LOOKBACK),
    ]);
    if (infractions.error || recent.error) {
      console.error(
        "chat moderation lookup failed",
        infractions.error?.message ?? recent.error?.message,
      );
      return { ok: false, reason: "error" };
    }

    const times = (infractions.data ?? []).map((r) => Date.parse(r.created_at));
    const until = muteUntil(times, Date.now());
    if (until !== null)
      return {
        ok: false,
        reason: "muted",
        until: Number.isFinite(until) ? new Date(until).toISOString() : null,
        message: mutedMessage(until),
      };

    const rule = moderateMessage(
      data.body,
      (recent.data ?? []).map((r) => r.body),
    );
    if (rule) {
      const { error } = await supabaseAdmin
        .from("chat_infractions")
        .insert({ user_id: context.userId, reason: rule });
      if (error) console.error("chat infraction insert failed", error.message);
      return { ok: false, reason: "blocked", rule, message: MODERATION_MESSAGES[rule] };
    }

    const { data: id, error } = await supabaseAdmin.rpc("send_chat_message_for", {
      _user_id: context.userId,
      message_body: data.body,
    });
    if (error) {
      if (error.message.includes("rate_limited")) return { ok: false, reason: "rate_limited" };
      if (error.message.includes("invalid_length")) return { ok: false, reason: "invalid_length" };
      console.error("send_chat_message_for falhou", error.message);
      return { ok: false, reason: "error" };
    }
    // Aviso por push aos demais inscritos, sem segurar a resposta do envio.
    void (async () => {
      const { data: message } = await supabaseAdmin
        .from("chat_messages")
        .select("display_name")
        .eq("id", String(id))
        .maybeSingle();
      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("user_id")
        .neq("user_id", context.userId)
        .limit(MAX_TOKENS_PER_EVENT);
      const userIds = [...new Set((subs ?? []).map((row) => row.user_id))];
      notifyUsers(supabaseAdmin, userIds, {
        title: "Sala dos técnicos",
        body: `${message?.display_name ?? "Um técnico"} enviou uma mensagem no chat.`,
        path: "/chat",
      });
    })().catch((pushError: unknown) => console.error("Push do chat indisponível", pushError));
    return { ok: true, id: String(id) };
  });

const SendRoomMessageInput = z
  .object({
    roomId: z.string().uuid(),
    clientMessageId: z.string().uuid().optional(),
    text: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(1).max(200))
      .refine(hasVisibleText),
  })
  .strict();

export type SendRoomMessageResult =
  | { ok: true; id: string; text: string; senderId: string; createdAt: string }
  | {
      ok: false;
      reason: "rate_limited" | "room_unavailable" | "blocked" | "muted" | "error";
      message?: string;
      until?: string | null;
    };

/** Sala chat: identidade, moderação, rate-limit e publicação permanecem server-side. */
export const sendRoomChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SendRoomMessageInput.parse(input))
  .handler(async ({ data, context }): Promise<SendRoomMessageResult> => {
    if (!context.userId) return { ok: false, reason: "room_unavailable" };
    const baseUrl = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!baseUrl || !serviceKey) return { ok: false, reason: "error" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { roomChatFingerprints } = await import("./room-chat-fingerprint");
    // New forward RPCs use a narrow adapter until generated database types are
    // refreshed; the server role remains the only principal with EXECUTE.
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      args: Record<string, string | boolean | null>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const id = data.clientMessageId ?? crypto.randomUUID();
    const hashes = await roomChatFingerprints(data.roomId, data.text);
    const { data: admission, error } = await rpc("admit_room_chat_message", {
      p_user_id: context.userId,
      p_room_id: data.roomId,
      p_message_id: id,
      p_payload_hash: hashes.payloadHash,
      p_repeat_fingerprint: hashes.repeatFingerprint,
      p_moderation_reason: moderateMessage(data.text),
    });
    if (error || !admission || typeof admission !== "object") return { ok: false, reason: "error" };
    const receipt = admission as Record<string, unknown>;
    if (receipt["status"] === "room_unavailable") return { ok: false, reason: "room_unavailable" };
    if (receipt["status"] === "muted") {
      const until = typeof receipt["until"] === "string" ? Date.parse(receipt["until"]) : NaN;
      if (!Number.isFinite(until)) return { ok: false, reason: "error" };
      return {
        ok: false,
        reason: "muted",
        until: new Date(until).toISOString(),
        message: mutedMessage(until),
      };
    }
    if (receipt["status"] === "rate_limited" || receipt["status"] === "pending")
      return { ok: false, reason: "rate_limited" };
    if (receipt["status"] === "blocked") {
      const rule = receipt["rule"];
      if (typeof rule !== "string" || !Object.hasOwn(MODERATION_MESSAGES, rule))
        return { ok: false, reason: "error" };
      return {
        ok: false,
        reason: "blocked",
        message: MODERATION_MESSAGES[rule as ModerationReason],
      };
    }
    const createdAt = receipt["createdAt"];
    if (typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)))
      return { ok: false, reason: "error" };
    const message = { id, text: data.text, senderId: context.userId, createdAt };
    if (receipt["status"] === "sent") return { ok: true, ...message };
    const leaseToken = receipt["leaseToken"];
    if (receipt["status"] !== "leased" || !z.string().uuid().safeParse(leaseToken).success)
      return { ok: false, reason: "error" };
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          { topic: `room-chat-${data.roomId}`, event: "msg", payload: message, private: true },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null);
    // Ambiguous network failures may have reached Realtime already. Retry uses
    // this same opaque message id; receivers dedupe it before rendering.
    const finished = await rpc("finish_room_chat_message", {
      p_user_id: context.userId,
      p_message_id: id,
      p_lease_token: leaseToken as string,
      p_delivered: response?.ok === true,
    });
    if (!response?.ok || finished.error || finished.data !== true)
      return { ok: false, reason: "error" };
    return { ok: true, ...message };
  });
