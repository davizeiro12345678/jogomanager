import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
type Room = Database["public"]["Tables"]["match_rooms"]["Row"];
type CreationResult =
  | { ok: true; room: Room }
  | { ok: false; reason: "create_failed" | "rate_limited" | "too_many_rooms" };

function secureRoomCode(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (value) => ROOM_CODE_ALPHABET[value & 31]).join("");
}

/** One RPC owns the room, private seed and account quota in one transaction. */
export async function createPrivateMatchRoom(
  db: Pick<SupabaseClient<Database>, "rpc">,
  userId: string,
  hostClub: string,
): Promise<CreationResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await db.rpc("create_match_room_for", {
      p_host_id: userId,
      p_host_club: hostClub,
      p_code: secureRoomCode(),
      p_seed: globalThis.crypto.randomUUID(),
    });
    const created = data?.[0];
    if (!error && created?.result === "created" && created.room)
      return { ok: true, room: created.room };
    if (!error && created?.result === "room_hourly_limit")
      return { ok: false, reason: "rate_limited" };
    if (!error && created?.result === "room_active_limit")
      return { ok: false, reason: "too_many_rooms" };
    if (error?.message.includes("room_hourly_limit")) return { ok: false, reason: "rate_limited" };
    if (error?.message.includes("room_active_limit"))
      return { ok: false, reason: "too_many_rooms" };
    if (error?.code !== "23505") return { ok: false, reason: "create_failed" };
  }
  return { ok: false, reason: "create_failed" };
}
