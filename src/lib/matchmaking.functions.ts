import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CLUBS } from "@/game/data/leagues";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const JoinRequest = z
  .object({
    clubId: z.string().min(1).max(80),
    mode: z.enum(["casual", "ranked"]),
  })
  .strict();

type QueueResult =
  | { ok: true; status: "waiting" | "reserved"; rating?: number }
  | { ok: false; reason: "unavailable" | "invalid_club" | "rate_limited" };

function configuredMatchmakingRegion(): "sa" | "na" | "eu" | "apac" | null {
  const configured = process.env["MATCHMAKING_REGION"];
  return configured === "sa" || configured === "na" || configured === "eu" || configured === "apac"
    ? configured
    : null;
}

/**
 * Feature-flagged. User identity comes from requireSupabaseAuth, rating from
 * the locked private DB table, and region from server configuration. No
 * client-supplied rating, opponent, queue age, or privilege is trusted.
 */
export const joinMatchmakingQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => JoinRequest.parse(input))
  .handler(async ({ data, context }): Promise<QueueResult> => {
    if (process.env["MATCHMAKING_QUEUE_ENABLED"] !== "true")
      return { ok: false, reason: "unavailable" };
    const region = configuredMatchmakingRegion();
    if (!region) return { ok: false, reason: "unavailable" };
    if (!Object.hasOwn(CLUBS, data.clubId)) return { ok: false, reason: "invalid_club" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: result, error } = await rpc("match_queue_join", {
      p_user: context.userId,
      p_club: data.clubId,
      p_mode: data.mode,
      p_region: region,
    });
    if (error || !result || typeof result !== "object" || Array.isArray(result))
      return { ok: false, reason: "unavailable" };
    const receipt = result as Record<string, unknown>;
    if (receipt["status"] === "reserved") return { ok: true, status: "reserved" };
    if (
      receipt["status"] === "waiting" &&
      typeof receipt["rating"] === "number" &&
      Number.isSafeInteger(receipt["rating"]) &&
      receipt["rating"] >= 0 &&
      receipt["rating"] <= 5000
    )
      return { ok: true, status: "waiting", rating: receipt["rating"] };
    return { ok: false, reason: "unavailable" };
  });

export const leaveMatchmakingQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async ({ context }): Promise<QueueResult> => {
    if (process.env["MATCHMAKING_QUEUE_ENABLED"] !== "true")
      return { ok: false, reason: "unavailable" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("match_queue_leave", { p_user: context.userId });
    // An already paired user cannot cancel the reservation and steal a second
    // seat. They must finish or follow the server-side pairing recovery path.
    if (error) return { ok: false, reason: "unavailable" };
    if (data !== true) return { ok: false, reason: "rate_limited" };
    return { ok: true, status: "waiting" };
  });

export type MatchmakingQueueStatus =
  | { status: "disabled" | "unavailable" | "not_joined" }
  | { status: "waiting" | "reserved"; mode: "casual" | "ranked"; region: string }
  | { status: "matched"; mode: "casual" | "ranked"; roomId: string };

export const getMatchmakingQueueStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({}).strict().parse(input))
  .handler(async ({ context }): Promise<MatchmakingQueueStatus> => {
    if (process.env["MATCHMAKING_QUEUE_ENABLED"] !== "true" || !configuredMatchmakingRegion())
      return { status: "disabled" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
      name: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc("match_queue_status", { p_user: context.userId });
    if (error || !data || typeof data !== "object" || Array.isArray(data))
      return { status: "unavailable" };
    const receipt = data as Record<string, unknown>;
    if (receipt["status"] === "not_joined") return { status: "not_joined" };
    const mode = receipt["mode"];
    if (mode !== "casual" && mode !== "ranked") return { status: "unavailable" };
    if (
      receipt["status"] === "matched" &&
      typeof receipt["roomId"] === "string" &&
      z.string().uuid().safeParse(receipt["roomId"]).success
    )
      return { status: "matched", roomId: receipt["roomId"], mode };
    if (
      (receipt["status"] === "waiting" || receipt["status"] === "reserved") &&
      typeof receipt["region"] === "string"
    )
      return { status: receipt["status"], mode, region: receipt["region"] };
    return { status: "unavailable" };
  });
