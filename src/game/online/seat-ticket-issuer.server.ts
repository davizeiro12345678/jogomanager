import { z } from "zod";
import { MATCH_PROTOCOL_VERSION, type MatchSeat, type MatchTicketV1 } from "./match-protocol";
import { createMatchTicketNonce, signMatchTicketV1 } from "./ticket-signing";

const UuidSchema = z.string().uuid();
const TICKET_LIFETIME_MS = 90_000;

export interface TicketRoom {
  id: string;
  host_id: string;
  guest_id: string | null;
  status: string;
  server_seeded: boolean;
}

export type TicketIssueResult =
  | { ok: true; ticket: MatchTicketV1 }
  | { ok: false; reason: "unauthorized" | "unavailable" };

/** The lookup is injected by the authenticated server and never by the browser. */
export interface TicketIssuerDependencies {
  loadRoom: (roomId: string) => Promise<TicketRoom | null>;
  signingSecret: string;
  now?: () => number;
}

/**
 * Issue a cryptographically signed short-lived seat ticket only to the user
 * who occupies the room. The room seed, service key and HMAC secret never
 * cross the network response. The transport still must verify every ticket.
 */
export async function issueMatchSeatTicket(
  dependencies: TicketIssuerDependencies,
  userId: string,
  roomId: string,
): Promise<TicketIssueResult> {
  if (!UuidSchema.safeParse(userId).success || !UuidSchema.safeParse(roomId).success)
    return { ok: false, reason: "unauthorized" };
  let room: TicketRoom | null;
  try {
    room = await dependencies.loadRoom(roomId);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (
    !room ||
    room.id !== roomId ||
    room.status !== "live" ||
    !room.server_seeded ||
    !room.guest_id ||
    !UuidSchema.safeParse(room.host_id).success ||
    !UuidSchema.safeParse(room.guest_id).success
  )
    return { ok: false, reason: "unavailable" };

  const seat: MatchSeat | null =
    room.host_id === userId ? "home" : room.guest_id === userId ? "away" : null;
  if (!seat) return { ok: false, reason: "unauthorized" };
  const now = (dependencies.now ?? Date.now)();
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - TICKET_LIFETIME_MS)
    return { ok: false, reason: "unavailable" };

  // Invalid secret configuration is a service failure, not a reason to issue
  // an unsigned ticket or silently fall back to a public room identifier.
  try {
    const ticket = await signMatchTicketV1(
      {
        version: MATCH_PROTOCOL_VERSION,
        roomId,
        userId,
        seat,
        issuedAt: now,
        expiresAt: now + TICKET_LIFETIME_MS,
        nonce: createMatchTicketNonce(),
      },
      dependencies.signingSecret,
    );
    return { ok: true, ticket };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
