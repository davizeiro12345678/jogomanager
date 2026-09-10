import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendMessageInput = z.object({
  body: z.string().min(1).max(500),
});

export type SendMessageResult =
  | { ok: true; id: string }
  | { ok: false; reason: "rate_limited" | "invalid_length" | "error" };

/**
 * Envio de mensagem no chat global. Só quem está logado consegue chamar:
 * a identidade vem do token verificado no servidor, nunca do navegador.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendMessageInput.parse(input))
  .handler(async ({ data, context }): Promise<SendMessageResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    return { ok: true, id: id as unknown as string };
  });
