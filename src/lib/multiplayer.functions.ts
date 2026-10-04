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

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

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

function secureRoomCode(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => ROOM_CODE_ALPHABET[value & 31]).join("");
}

export const createMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ hostClub: z.string().min(1).max(80) }).parse(input))
  .handler(async ({ data, context }): Promise<RoomActionResult> => {
    if (!CLUBS[data.hostClub]) return { ok: false, reason: "invalid_club" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const seed = globalThis.crypto.randomUUID();
      const { data: room, error } = await supabaseAdmin
        .from("match_rooms")
        .insert({
          code: secureRoomCode(),
          host_id: context.userId,
          host_club: data.hostClub,
          seed: "",
          server_seeded: true,
          status: "open",
          minute: 0,
          state: {},
        })
        .select("*")
        .single();
      if (!error && room) {
        const { error: secretError } = await supabaseAdmin
          .from("match_room_secrets")
          .insert({ room_id: room.id, seed });
        if (secretError) {
          await supabaseAdmin.from("match_rooms").delete().eq("id", room.id);
          return { ok: false, reason: "create_failed" };
        }
        return { ok: true, room: room as unknown as MultiplayerRoomRecord };
      }
      if (error?.code !== "23505") return { ok: false, reason: "create_failed" };
    }
    return { ok: false, reason: "create_failed" };
  });

export const joinMatchRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ roomId: z.string().uuid(), guestClub: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RoomActionResult> => {
    if (!CLUBS[data.guestClub]) return { ok: false, reason: "invalid_club" };
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
      !CLUBS[currentRoom.host_club] ||
      !CLUBS[currentRoom.guest_club]
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
      .select("id, host_id, guest_id, status")
      .eq("id", data.roomId)
      .maybeSingle();
    if (lookupError || !room) return { ok: false, reason: "not_found" };
    if (room.host_id !== context.userId && room.guest_id !== context.userId) {
      return { ok: false, reason: "not_participant" };
    }
    if (room.status === "done") return { ok: true };
    const { error } = await supabaseAdmin
      .from("match_rooms")
      .update({ status: "done", state: {}, updated_at: new Date().toISOString() })
      .eq("id", data.roomId)
      .eq("status", room.status);
    if (error) return { ok: false, reason: "leave_failed" };
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
      .select("id, host_id, guest_club, host_club, server_seeded, status, state")
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
    if (room.status !== "live") return { ok: false, reason: "not_live" };
    if (!room.server_seeded || !room.guest_club) {
      return { ok: false, reason: "invalid_room" };
    }
    const { data: secret, error: secretError } = await supabaseAdmin
      .from("match_room_secrets")
      .select("seed")
      .eq("room_id", room.id)
      .maybeSingle();
    if (secretError || !secret?.seed) return { ok: false, reason: "invalid_room" };
    if (!CLUBS[room.host_club] || !CLUBS[room.guest_club]) {
      return { ok: false, reason: "invalid_room" };
    }

    const sim = new MatchSim(
      buildTeamSetup(room.host_club),
      buildTeamSetup(room.guest_club),
      secret.seed,
    );
    let steps = 0;
    while (!sim.finished && steps++ < MATCH_SIMULATION_TICK_LIMIT) {
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    }
    if (!sim.finished) return { ok: false, reason: "simulation_failed" };

    const { data: updatedRoom, error: updateError } = await supabaseAdmin
      .from("match_rooms")
      .update({
        status: "done",
        minute: sim.minute(),
        state: { hg: sim.stats.home.goals, ag: sim.stats.away.goals },
        updated_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .eq("host_id", context.userId)
      .eq("status", "live")
      .eq("server_seeded", true)
      .select("id")
      .maybeSingle();
    if (updateError) return { ok: false, reason: "update_failed" };
    if (!updatedRoom) return { ok: false, reason: "room_closed" };
    await supabaseAdmin.from("match_room_secrets").delete().eq("room_id", room.id);
    return { ok: true };
  });
