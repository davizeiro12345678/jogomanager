import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { containsProfanity } from "@/lib/moderation";
import { hasVisibleText, normalizePublicText } from "@/lib/untrusted-json";

const input = z
  .object({
    roomId: z.string().uuid(),
    body: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(1).max(200))
      .refine(hasVisibleText),
  })
  .strict();

export type RoomChatSendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "blocked" | "rate_limited" | "not_participant" | "error" };

export const sendRoomChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data, context }): Promise<RoomChatSendResult> => {
    if (containsProfanity(data.body)) return { ok: false, reason: "blocked" };
    const { reviewChatBeforePublish } = await import("@/lib/context-moderation.server");
    const review = await reviewChatBeforePublish(context.userId, data.body, data.roomId);
    if (review !== "allow")
      return {
        ok: false,
        reason: review === "block" ? "blocked" : review === "rate_limited" ? review : "error",
      };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("send_match_room_message_for", {
      _room_id: data.roomId,
      _user_id: context.userId,
      _body: data.body,
    });
    if (error) {
      if (error.message.includes("not_participant"))
        return { ok: false, reason: "not_participant" };
      if (error.message.includes("rate_limited")) return { ok: false, reason: "rate_limited" };
      return { ok: false, reason: "error" };
    }
    return typeof id === "string" ? { ok: true, id } : { ok: false, reason: "error" };
  });
