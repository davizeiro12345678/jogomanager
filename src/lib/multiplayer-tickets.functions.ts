import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MatchTicketV1 } from "@/game/online/match-protocol";

type TicketResponse =
  | { ok: true; ticket: MatchTicketV1 }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export const getMatchSeatTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ roomId: z.string().uuid() }).strict().parse(input))
  .handler(async ({ data, context }): Promise<TicketResponse> => {
    // This server function is NOT a public WebSocket route. It issues a
    // credential only for a verified room participant with a live match.
    const secret = process.env["MATCH_TICKET_SIGNING_SECRET"];
    if (!secret) return { ok: false, reason: "unavailable" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueMatchSeatTicket } = await import("@/game/online/seat-ticket-issuer.server");
    return issueMatchSeatTicket(
      {
        signingSecret: secret,
        loadRoom: async (roomId) => {
          const { data: room, error } = await supabaseAdmin
            .from("match_rooms")
            .select("id, host_id, guest_id, status, server_seeded")
            .eq("id", roomId)
            .maybeSingle();
          if (error) throw error;
          return room;
        },
      },
      context.userId,
      data.roomId,
    );
  });
