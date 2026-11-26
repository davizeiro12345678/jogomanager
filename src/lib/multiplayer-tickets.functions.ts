import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MatchTicketV1 } from "@/game/online/match-protocol";
import type { CooperativeSeatTicketIssueResult } from "@/game/online/cooperative-seat-ticket-v2.server";

const parseRoom = (input: unknown) => z.object({ roomId: z.string().uuid() }).strict().parse(input);

type TicketResponse =
  { ok: true; ticket: MatchTicketV1 } | { ok: false; reason: "unauthorized" | "unavailable" };

export const getMatchSeatTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseRoom)
  .handler(async ({ data, context }): Promise<TicketResponse> => {
    // This server function is NOT a public WebSocket route. It issues a
    // credential only for a verified room participant with a live match.
    const secret = process.env["MATCH_TICKET_SIGNING_SECRET"];
    if (!secret || process.env["MATCH_AUTHORITY_ENABLED"] !== "true")
      return { ok: false, reason: "unavailable" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { issueMatchSeatTicket } = await import("@/game/online/seat-ticket-issuer.server");
    return issueMatchSeatTicket(
      {
        signingSecret: secret,
        loadRoom: async (roomId) => {
          const { data: room, error } = await supabaseAdmin
            .from("match_rooms")
            .select("id, host_id, guest_id, status, settlement_authority, server_seeded")
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

export const getStagingCooperativeSeatTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseRoom)
  .handler(async ({ data, context }): Promise<CooperativeSeatTicketIssueResult> => {
    const env = process.env;
    const signingSecret = env["MATCH_COOPERATIVE_TICKET_SIGNING_SECRET"];
    if (
      env["MATCH_AUTHORITY_ENV"] !== "staging" ||
      env["MATCH_COOPERATIVE_AUTHORITY_ENABLED"] !== "true" ||
      !signingSecret ||
      signingSecret.trim() === env["MATCH_TICKET_SIGNING_SECRET"]?.trim()
    ) {
      return { ok: false, reason: "unavailable" };
    }
    const { issueCooperativeSeatTicketV2 } =
      await import("@/game/online/cooperative-seat-ticket-v2.server");
    const { loadStagingCooperativeRoster } =
      await import("../../services/match-authority/supabase");
    return issueCooperativeSeatTicketV2(
      {
        signingSecret,
        loadTrustedRoster: (roomId) =>
          loadStagingCooperativeRoster(
            {
              MATCH_AUTHORITY_ENV: "staging",
              STAGING_SUPABASE_PROJECT_REF: env["STAGING_SUPABASE_PROJECT_REF"] ?? "",
              SUPABASE_URL: env["SUPABASE_URL"] ?? "",
              SUPABASE_SERVICE_ROLE_KEY: env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
            },
            roomId,
          ),
      },
      context.userId,
      data.roomId,
    );
  });
