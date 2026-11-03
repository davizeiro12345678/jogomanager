import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePublicText, hasVisibleText } from "./untrusted-json";
import { MODERATION_MESSAGES, moderateMessage, type ModerationReason } from "./moderation";
import { INFRACTION_WINDOW_MS, muteUntil } from "./chat-penalties";

const SendMessageInput = z.object({
  body: z
    .string()
    .transform(normalizePublicText)
    .pipe(z.string().min(1).max(500))
    .refine(hasVisibleText),
});

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
      console.error("chat moderation lookup failed", infractions.error?.message ?? recent.error?.message);
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
    return { ok: true, id: String(id) };
  });
