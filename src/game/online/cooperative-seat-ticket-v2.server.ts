import { z } from "zod";
import { canonicalize } from "./session-hash";
import { createMatchTicketNonce } from "./ticket-signing";
import type { MatchCommandKind, MatchSeat } from "./match-protocol";

/**
 * Server-only cooperative 2x2 v2 wire contracts.
 *
 * Distinct from the shipped two-seat MatchTicketV1, with separate HMAC domain.
 * Never pass a client-supplied roster to issueCooperativeSeatTicketV2.
 * This module does not enable four-seat DO admission, persistence or production.
 */
export const COOPERATIVE_PROTOCOL_VERSION = 2 as const;
export const CooperativeSeatV2Schema = z.enum([
  "home_captain",
  "home_partner",
  "away_captain",
  "away_partner",
]);
export type CooperativeSeatV2 = z.infer<typeof CooperativeSeatV2Schema>;

const UserId = z.string().uuid();
const Clock = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Nonce = z
  .string()
  .min(16)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);
const Signature = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const CooperativeRosterV2Schema = z
  .object({
    version: z.literal(COOPERATIVE_PROTOCOL_VERSION),
    roomId: UserId,
    status: z.literal("live"),
    settlementAuthority: z.literal("websocket"),
    serverSeeded: z.literal(true),
    seats: z
      .object({
        home_captain: UserId,
        home_partner: UserId,
        away_captain: UserId,
        away_partner: UserId,
      })
      .strict(),
  })
  .strict()
  .superRefine((roster, ctx) => {
    const participants = Object.values(roster.seats).map((id) => id.toLowerCase());
    if (new Set(participants).size !== 4) {
      ctx.addIssue({
        code: "custom",
        message: "four independent people must occupy the four cooperative seats",
        path: ["seats"],
      });
    }
  });

export type CooperativeRosterV2 = z.infer<typeof CooperativeRosterV2Schema>;

const UnsignedTicket = z
  .object({
    version: z.literal(COOPERATIVE_PROTOCOL_VERSION),
    roomId: UserId,
    userId: UserId,
    seat: CooperativeSeatV2Schema,
    issuedAt: Clock,
    expiresAt: Clock,
    nonce: Nonce,
  })
  .strict()
  .superRefine((ticket, ctx) => {
    if (ticket.expiresAt <= ticket.issuedAt || ticket.expiresAt - ticket.issuedAt > 90_000) {
      ctx.addIssue({
        code: "custom",
        message: "cooperative seat ticket must expire within 90 seconds",
        path: ["expiresAt"],
      });
    }
  });

export const CooperativeSeatTicketV2Schema = UnsignedTicket.safeExtend({
  signature: Signature,
});
export type CooperativeSeatTicketV2 = z.infer<typeof CooperativeSeatTicketV2Schema>;
export type UnsignedCooperativeSeatTicketV2 = z.infer<typeof UnsignedTicket>;

export function cooperativeSeatForUser(
  roster: CooperativeRosterV2,
  userId: string,
): CooperativeSeatV2 | null {
  for (const seat of CooperativeSeatV2Schema.options) {
    if (roster.seats[seat] === userId) return seat;
  }
  return null;
}

export function cooperativeTeamForSeat(seat: CooperativeSeatV2): MatchSeat {
  return seat.startsWith("home_") ? "home" : "away";
}

/** Forfeit stays governed by two independent teammate votes on the room owner. */
export function canExecuteCooperativeSeatCommand(
  seat: CooperativeSeatV2,
  kind: MatchCommandKind,
): boolean {
  if (kind === "ready" || kind === "ack_snapshot") return true;
  if (kind === "set_tactics" || kind === "substitute") return seat.endsWith("_captain");
  return false;
}

const ENCODER = new TextEncoder();
const DOMAIN = "pfm-cooperative-seat-ticket-v2";

function requireSecret(secret: string): string {
  if (typeof secret !== "string" || secret.trim().length < 32)
    throw new Error("cooperative match requires an isolated HMAC signing key");
  return secret.trim();
}

async function hmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto is required for cooperative tickets");
  return globalThis.crypto.subtle.importKey(
    "raw",
    ENCODER.encode(requireSecret(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

function canonicalTicket(ticket: UnsignedCooperativeSeatTicketV2): Uint8Array<ArrayBuffer> {
  const validated = UnsignedTicket.parse(ticket);
  return ENCODER.encode(canonicalize({ domain: DOMAIN, ticket: validated }));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error("invalid cooperative signature");
  const binary = atob(
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4),
  );
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signCooperativeSeatTicketV2(
  input: UnsignedCooperativeSeatTicketV2,
  secret: string,
): Promise<CooperativeSeatTicketV2> {
  const unsigned = UnsignedTicket.parse(input);
  const key = await hmacKey(secret, "sign");
  const digest = await globalThis.crypto.subtle.sign("HMAC", key, canonicalTicket(unsigned));
  return CooperativeSeatTicketV2Schema.parse({
    ...unsigned,
    signature: toBase64Url(new Uint8Array(digest)),
  });
}

/** Verify the authentic server-persisted roster, signature, timestamp and all claims. */
export async function verifyCooperativeSeatTicketV2(
  input: unknown,
  trustedRoster: unknown,
  secret: string,
  now: number,
): Promise<boolean> {
  try {
    if (!Number.isSafeInteger(now) || now < 0) return false;
    const roster = CooperativeRosterV2Schema.parse(trustedRoster);
    const ticket = CooperativeSeatTicketV2Schema.parse(input);
    if (
      ticket.roomId !== roster.roomId ||
      ticket.issuedAt > now ||
      ticket.expiresAt <= now ||
      cooperativeSeatForUser(roster, ticket.userId) !== ticket.seat
    )
      return false;
    const { signature, ...unsigned } = ticket;
    const key = await hmacKey(secret, "verify");
    return await globalThis.crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      canonicalTicket(unsigned),
    );
  } catch {
    return false;
  }
}

export interface CooperativeSeatTicketIssuerDependencies {
  /** Server reads a private, committed roster; never pass a browser callback. */
  loadTrustedRoster: (roomId: string) => Promise<unknown>;
  signingSecret: string;
  now?: () => number;
}

export type CooperativeSeatTicketIssueResult =
  | { ok: true; ticket: CooperativeSeatTicketV2 }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export async function issueCooperativeSeatTicketV2(
  deps: CooperativeSeatTicketIssuerDependencies,
  userId: string,
  roomId: string,
): Promise<CooperativeSeatTicketIssueResult> {
  if (!UserId.safeParse(userId).success || !UserId.safeParse(roomId).success)
    return { ok: false, reason: "unauthorized" };
  let roster: CooperativeRosterV2;
  try {
    roster = CooperativeRosterV2Schema.parse(await deps.loadTrustedRoster(roomId));
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (roster.roomId !== roomId) return { ok: false, reason: "unavailable" };
  const seat = cooperativeSeatForUser(roster, userId);
  if (!seat) return { ok: false, reason: "unauthorized" };
  const now = (deps.now ?? Date.now)();
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - 90_000)
    return { ok: false, reason: "unavailable" };
  try {
    return {
      ok: true,
      ticket: await signCooperativeSeatTicketV2(
        {
          version: COOPERATIVE_PROTOCOL_VERSION,
          roomId,
          userId,
          seat,
          issuedAt: now,
          expiresAt: now + 90_000,
          nonce: createMatchTicketNonce(),
        },
        deps.signingSecret,
      ),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
