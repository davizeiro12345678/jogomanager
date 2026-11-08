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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error: roomError } = await supabaseAdmin
      .from("match_rooms")
      .select("id, host_id, guest_id, status")
      .eq("id", data.roomId)
      .maybeSingle();
    if (
      roomError ||
      !room ||
      (room.host_id !== context.userId && room.guest_id !== context.userId) ||
      !["open", "ready", "live", "settling"].includes(room.status)
    ) {
      return { ok: false, reason: "room_unavailable" };
    }

    const now = Date.now();
    const since = new Date(now - INFRACTION_WINDOW_MS).toISOString();
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
    if (infractions.error || recent.error) return { ok: false, reason: "error" };
    const until = muteUntil(
      (infractions.data ?? []).map((r) => Date.parse(r.created_at)),
      now,
    );
    if (until !== null)
      return {
        ok: false,
        reason: "muted",
        until: Number.isFinite(until) ? new Date(until).toISOString() : null,
        message: mutedMessage(until),
      };

    const rule = moderateMessage(
      data.text,
      (recent.data ?? []).map((r) => r.body),
    );
    if (rule) {
      const { error } = await supabaseAdmin
        .from("chat_infractions")
        .insert({ user_id: context.userId, reason: rule });
      if (error) console.error("room chat infraction insert failed", error.message);
      return { ok: false, reason: "blocked", message: MODERATION_MESSAGES[rule] };
    }

    const bucket = Math.floor(now / 1000);
    const { error: cleanupError } = await supabaseAdmin
      .from("room_chat_rate_limits")
      .delete()
      .eq("user_id", context.userId)
      .lt("second_bucket", bucket);
    if (cleanupError) return { ok: false, reason: "error" };
    const { error: limitError } = await supabaseAdmin
      .from("room_chat_rate_limits")
      .insert({ user_id: context.userId, second_bucket: bucket });
    if (limitError)
      return limitError.code === "23505"
        ? { ok: false, reason: "rate_limited" }
        : { ok: false, reason: "error" };

    const message = {
      id: globalThis.crypto.randomUUID(),
      text: data.text,
      senderId: context.userId,
      createdAt: new Date(now).toISOString(),
    };
    const baseUrl = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!baseUrl || !serviceKey) return { ok: false, reason: "error" };
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
    }).catch(() => null);
    if (!response?.ok) return { ok: false, reason: "error" };
    return { ok: true, ...message };
  });
