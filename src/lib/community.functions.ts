import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Moderação a cargo do jogador: bloquear alguém esconde as mensagens dessa
 * pessoa para quem bloqueou, e denunciar registra o caso para revisão.
 */

const BlockInput = z.object({ userId: z.string().uuid() });
const ReportInput = z.object({
  messageId: z.string().uuid(),
  reason: z.string().min(3).max(200),
});

export type SimpleResult = { ok: true } | { ok: false; reason: "error" };

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BlockInput.parse(input))
  .handler(async ({ data, context }): Promise<SimpleResult> => {
    if (data.userId === context.userId) return { ok: false, reason: "error" };
    const { error } = await context.supabase
      .from("user_blocks")
      .upsert({ user_id: context.userId, blocked_id: data.userId });
    if (error) {
      console.error("blockUser falhou", error.message);
      return { ok: false, reason: "error" };
    }
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BlockInput.parse(input))
  .handler(async ({ data, context }): Promise<SimpleResult> => {
    const { error } = await context.supabase
      .from("user_blocks")
      .delete()
      .eq("user_id", context.userId)
      .eq("blocked_id", data.userId);
    if (error) {
      console.error("unblockUser falhou", error.message);
      return { ok: false, reason: "error" };
    }
    return { ok: true };
  });

export const listBlockedUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await context.supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("user_id", context.userId);
    if (error || !data) return [];
    return data.map((row) => row.blocked_id);
  });

export const reportChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data, context }): Promise<SimpleResult> => {
    const { error } = await context.supabase.from("chat_reports").insert({
      message_id: data.messageId,
      reporter_id: context.userId,
      reason: data.reason.trim(),
    });
    // Denúncia repetida da mesma mensagem conta como sucesso.
    if (error && !error.message.includes("duplicate key")) {
      console.error("reportChatMessage falhou", error.message);
      return { ok: false, reason: "error" };
    }
    return { ok: true };
  });
