import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FinishInput = z.object({
  roomId: z.string().uuid(),
  minute: z.number().int().min(0).max(120),
  homeGoals: z.number().int().min(0).max(30),
  awayGoals: z.number().int().min(0).max(30),
});

export type FinishRoomResult = { ok: true } | { ok: false; reason: string };

/**
 * Encerra a sala multijogador.
 *
 * O resultado só é gravado depois que o servidor confirma que quem está
 * enviando é o anfitrião daquela sala, que a partida estava realmente em
 * andamento e que o placar está dentro de limites plausíveis. A sala também
 * não pode ser reescrita depois de encerrada.
 */
export const finishMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FinishInput.parse(input))
  .handler(async ({ data, context }): Promise<FinishRoomResult> => {
    const { data: room, error } = await context.supabase
      .from("match_rooms")
      .select("id, host_id, status")
      .eq("id", data.roomId)
      .maybeSingle();
    if (error) return { ok: false, reason: "not_found" };
    if (!room) return { ok: false, reason: "not_found" };
    if (room.host_id !== context.userId) return { ok: false, reason: "not_host" };
    if (room.status === "done") return { ok: true };
    if (room.status !== "live") return { ok: false, reason: "not_live" };
    if (data.minute < 90) return { ok: false, reason: "not_finished" };

    const { error: updateError } = await context.supabase
      .from("match_rooms")
      .update({
        status: "done",
        minute: data.minute,
        state: { hg: data.homeGoals, ag: data.awayGoals },
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .eq("host_id", context.userId)
      .eq("status", "live");
    if (updateError) return { ok: false, reason: "update_failed" };
    return { ok: true };
  });
