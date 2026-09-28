import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CLUBS } from "@/game/data/leagues";
import { buildTeamSetup } from "@/game/quickMatch";
import { MatchSim } from "@/game/sim";

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
 * andamento e recalcula o placar da semente salva. A sala também
 * não pode ser reescrita depois de encerrada.
 */
export const finishMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FinishInput.parse(input))
  .handler(async ({ data, context }): Promise<FinishRoomResult> => {
    const { data: room, error } = await context.supabase
      .from("match_rooms")
      .select("id, host_id, status, host_club, guest_club, seed")
      .eq("id", data.roomId)
      .maybeSingle();
    if (error) return { ok: false, reason: "not_found" };
    if (!room) return { ok: false, reason: "not_found" };
    if (room.host_id !== context.userId) return { ok: false, reason: "not_host" };
    if (room.status === "done") return { ok: true };
    if (room.status !== "live") return { ok: false, reason: "not_live" };
    if (data.minute < 90) return { ok: false, reason: "not_finished" };
    if (!room.guest_club || !CLUBS[room.host_club] || !CLUBS[room.guest_club]) {
      return { ok: false, reason: "invalid_room" };
    }

    // The client can request publication, but cannot decide the official score.
    const sim = new MatchSim(
      buildTeamSetup(room.host_club),
      buildTeamSetup(room.guest_club),
      room.seed,
    );
    let steps = 0;
    while (!sim.finished && steps++ < 14_000) sim.step(0.4);
    if (!sim.finished) return { ok: false, reason: "simulation_failed" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("match_rooms")
      .update({
        status: "done",
        minute: sim.minute(),
        state: { hg: sim.stats.home.goals, ag: sim.stats.away.goals },
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .eq("host_id", context.userId)
      .eq("status", "live");
    if (updateError) return { ok: false, reason: "update_failed" };
    return { ok: true };
  });
