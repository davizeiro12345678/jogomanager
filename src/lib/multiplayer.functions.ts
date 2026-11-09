import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { CLUBS } from "@/game/data/leagues";
import { buildTeamSetup } from "@/game/quickMatch";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MatchSim,
} from "@/game/sim";
import {
  createSettlementLeaseGuard,
  isSettlementLeaseExpired,
  settlementLeaseCutoff,
} from "@/lib/multiplayer-settlement";

export interface MultiplayerRoomRecord {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_club: string;
  guest_club: string | null;
  seed: string;
  server_seeded: boolean;
  status: string;
  minute: number;
  state: Json;
  created_at: string;
  updated_at: string;
}

export type RoomActionResult =
  { ok: true; room: MultiplayerRoomRecord } | { ok: false; reason: string };

export type FinishRoomResult = { ok: true } | { ok: false; reason: string };

export const createMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ hostClub: z.string().min(1).max(80) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RoomActionResult> => {
    if (!Object.hasOwn(CLUBS, data.hostClub)) return { ok: false, reason: "invalid_club" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { createPrivateMatchRoom } = await import("./multiplayer-room-create.server");
    return createPrivateMatchRoom(supabaseAdmin, context.userId, data.hostClub);
  });

export const joinMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ roomId: z.string().uuid(), guestClub: z.string().min(1).max(80) })
      .strict()
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<RoomActionResult> => {
    if (!Object.hasOwn(CLUBS, data.guestClub)) return { ok: false, reason: "invalid_club" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error } = await supabaseAdmin
      .from("match_rooms")
      .update({
        guest_id: context.userId,
        guest_club: data.guestClub,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.roomId)
      .eq("status", "open")
      .eq("server_seeded", true)
      .is("guest_id", null)
      .neq("host_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error || !room) return { ok: false, reason: "room_unavailable" };
    return { ok: true, room: room as unknown as MultiplayerRoomRecord };
  });

export const startMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<RoomActionResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: currentRoom, error: roomError } = await supabaseAdmin
      .from("match_rooms")
      .select("id, host_id, host_club, guest_club, server_seeded, status")
      .eq("id", data.roomId)
      .maybeSingle();
    if (roomError || !currentRoom) return { ok: false, reason: "room_not_ready" };
    if (currentRoom.host_id !== context.userId) return { ok: false, reason: "not_host" };
    if (
      currentRoom.status !== "ready" ||
      !currentRoom.server_seeded ||
      !currentRoom.guest_club ||
      !Object.hasOwn(CLUBS, currentRoom.host_club) ||
      !Object.hasOwn(CLUBS, currentRoom.guest_club)
    ) {
      return { ok: false, reason: "room_not_ready" };
    }

    const { data: secret, error: secretError } = await supabaseAdmin
      .from("match_room_secrets")
      .select("seed")
      .eq("room_id", data.roomId)
      .maybeSingle();
    if (secretError || !secret?.seed) return { ok: false, reason: "room_not_ready" };
    const { data: room, error } = await supabaseAdmin
      .from("match_rooms")
      .update({
        status: "live",
        minute: 0,
        state: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.roomId)
      .eq("host_id", context.userId)
      .eq("status", "ready")
      .not("guest_id", "is", null)
      .not("guest_club", "is", null)
      .select("*")
      .maybeSingle();
    if (error || !room) {
      return { ok: false, reason: "room_not_ready" };
    }
    return { ok: true, room: room as unknown as MultiplayerRoomRecord };
  });

export const leaveMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<FinishRoomResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error: lookupError } = await supabaseAdmin
      .from("match_rooms")
      .select("id, host_id, guest_id, status, updated_at")
      .eq("id", data.roomId)
      .maybeSingle();
    if (lookupError || !room) return { ok: false, reason: "not_found" };
    if (room.host_id !== context.userId && room.guest_id !== context.userId) {
      return { ok: false, reason: "not_participant" };
    }
    if (room.status === "done") return { ok: true };
    // A deterministic replay is already running under a live server-side
    // lease. An expired lease can be closed by a participant, but the CAS
    // below must beat any concurrent reclaim before deleting the private seed.
    let leaveQuery = supabaseAdmin
      .from("match_rooms")
      .update({ status: "done", state: {}, updated_at: new Date().toISOString() })
      .eq("id", data.roomId);
    if (room.status === "settling") {
      if (!isSettlementLeaseExpired(room.updated_at)) return { ok: false, reason: "settling" };
      leaveQuery = leaveQuery.eq("status", "settling").lt("updated_at", settlementLeaseCutoff());
    } else {
      leaveQuery = leaveQuery.eq("status", room.status);
    }
    const { data: closedRoom, error } = await leaveQuery.select("id").maybeSingle();
    if (error) return { ok: false, reason: "leave_failed" };
    if (!closedRoom) {
      const { data: latestRoom, error: latestError } = await supabaseAdmin
        .from("match_rooms")
        .select("status")
        .eq("id", data.roomId)
        .maybeSingle();
      if (latestError || !latestRoom) return { ok: false, reason: "leave_failed" };
      if (latestRoom.status === "settling") return { ok: false, reason: "settling" };
      if (latestRoom.status === "done") return { ok: true };
      return { ok: false, reason: "leave_failed" };
    }
    await supabaseAdmin.from("match_room_secrets").delete().eq("room_id", data.roomId);
    return { ok: true };
  });

/**
 * The browser can only request publication. The server accepts only a room
 * created with its own seed, and replays the full match instead of trusting
 * client minute or score fields.
 */
export const finishMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ roomId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<FinishRoomResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: room, error } = await supabaseAdmin
      .from("match_rooms")
      .select("id, host_id, guest_club, host_club, server_seeded, status, state, updated_at")
      .eq("id", data.roomId)
      .maybeSingle();
    if (error || !room) return { ok: false, reason: "not_found" };
    if (room.host_id !== context.userId) return { ok: false, reason: "not_host" };
    if (room.status === "done") {
      if (!room.server_seeded) return { ok: false, reason: "room_closed" };
      const state = room.state as { hg?: unknown; ag?: unknown } | null;
      return Number.isInteger(state?.hg) && Number.isInteger(state?.ag)
        ? { ok: true }
        : { ok: false, reason: "room_closed" };
    }
    if (
      room.status !== "live" &&
      !(room.status === "settling" && isSettlementLeaseExpired(room.updated_at))
    ) {
      return room.status === "settling"
        ? { ok: false, reason: "settling" }
        : { ok: false, reason: "not_live" };
    }
    if (!room.server_seeded || !room.guest_club) {
      return { ok: false, reason: "invalid_room" };
    }
    if (!Object.hasOwn(CLUBS, room.host_club) || !Object.hasOwn(CLUBS, room.guest_club)) {
      return { ok: false, reason: "invalid_room" };
    }

    // Claim publication before the expensive full replay. The same CAS also
    // reclaims a stale settling lease. Repeated finish clicks therefore either
    // observe the active lease or atomically replace an expired one.
    const settlementLeaseCutoffAt = settlementLeaseCutoff();
    const { data: claim, error: claimError } = await supabaseAdmin
      .from("match_rooms")
      .update({ status: "settling", updated_at: new Date().toISOString() })
      .eq("id", room.id)
      .eq("host_id", context.userId)
      .eq("server_seeded", true)
      .not("guest_id", "is", null)
      .not("guest_club", "is", null)
      .or(`status.eq.live,and(status.eq.settling,updated_at.lt.${settlementLeaseCutoffAt})`)
      .select("id, updated_at")
      .maybeSingle();
    if (claimError) return { ok: false, reason: "update_failed" };
    if (!claim) {
      const { data: latest } = await supabaseAdmin
        .from("match_rooms")
        .select("status, server_seeded, state, updated_at")
        .eq("id", room.id)
        .maybeSingle();
      if (latest?.status === "settling") return { ok: false, reason: "settling" };
      const state = latest?.state as { hg?: unknown; ag?: unknown } | null;
      if (
        latest?.status === "done" &&
        latest.server_seeded &&
        Number.isInteger(state?.hg) &&
        Number.isInteger(state?.ag)
      ) {
        return { ok: true };
      }
      return { ok: false, reason: "room_closed" };
    }
    const claimLease = claim.updated_at;
    if (!claimLease) return { ok: false, reason: "update_failed" };

    const lease = createSettlementLeaseGuard(claimLease, async (expectedLease) => {
      const { data: refreshed, error: refreshError } = await supabaseAdmin
        .from("match_rooms")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", room.id)
        .eq("host_id", context.userId)
        .eq("status", "settling")
        .eq("server_seeded", true)
        .eq("updated_at", expectedLease)
        .select("updated_at")
        .maybeSingle();
      if (refreshError || !refreshed?.updated_at) return null;
      return refreshed.updated_at;
    });
    lease.start();

    let published = false;
    const releaseClaim = async () => {
      await supabaseAdmin
        .from("match_rooms")
        .update({ status: "live", updated_at: new Date().toISOString() })
        .eq("id", room.id)
        .eq("host_id", context.userId)
        .eq("status", "settling")
        .eq("server_seeded", true)
        .eq("updated_at", lease.currentLease());
    };

    try {
      const { data: secret, error: secretError } = await supabaseAdmin
        .from("match_room_secrets")
        .select("seed")
        .eq("room_id", room.id)
        .maybeSingle();
      if (secretError || !secret?.seed) return { ok: false, reason: "invalid_room" };

      // Only the trusted server may choose the remote authority.
      // Default production behavior stays unchanged until static-IP
      // egress, secrets, and Atlas connectivity pass an end-to-end test.
      const { matchAuxEnabled, simulateOnMatchAux } = await import("./match-aux-client.server");
      let result: { hg: number; ag: number; minute: number };
      if (matchAuxEnabled()) {
        const verified = await simulateOnMatchAux({
          roomId: room.id,
          homeClub: room.host_club,
          awayClub: room.guest_club,
          seed: secret.seed,
        });
        result = { hg: verified.hg, ag: verified.ag, minute: verified.minute };
      } else {
        const sim = new MatchSim(
          buildTeamSetup(room.host_club),
          buildTeamSetup(room.guest_club),
          secret.seed,
        );
        let steps = 0;
        while (!sim.finished && steps++ < MATCH_SIMULATION_TICK_LIMIT) {
          sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
          if (steps % 128 === 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
            if (lease.isLost()) return { ok: false, reason: "room_closed" };
          }
        }
        if (!sim.finished) return { ok: false, reason: "simulation_failed" };
        result = {
          hg: sim.stats.home.goals,
          ag: sim.stats.away.goals,
          minute: sim.minute(),
        };
      }

      await lease.stop();
      if (!(await lease.refresh()) || lease.isLost()) {
        return { ok: false, reason: "room_closed" };
      }
      const { data: updatedRoom, error: updateError } = await supabaseAdmin
        .from("match_rooms")
        .update({
          status: "done",
          minute: result.minute,
          state: { hg: result.hg, ag: result.ag },
          updated_at: new Date().toISOString(),
        })
        .eq("id", room.id)
        .eq("host_id", context.userId)
        .eq("status", "settling")
        .eq("server_seeded", true)
        .eq("updated_at", lease.currentLease())
        .select("id")
        .maybeSingle();
      if (updateError) return { ok: false, reason: "update_failed" };
      if (!updatedRoom) return { ok: false, reason: "room_closed" };
      published = true;
      // Secret cleanup is best effort only after the durable server result. A
      // transient cleanup error cannot make a completed result look failed.
      try {
        await supabaseAdmin.from("match_room_secrets").delete().eq("room_id", room.id);
      } catch {
        // The room stays completed and the private table remains server-only.
      }
      return { ok: true };
    } catch {
      return { ok: false, reason: "simulation_failed" };
    } finally {
      await lease.stop();
      if (!published) {
        try {
          await releaseClaim();
        } catch {
          // The next authorized finish attempt can recover the persisted claim.
        }
      }
    }
  });
