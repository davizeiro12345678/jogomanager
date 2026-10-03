import { z } from "zod";

/**
 * Public, versioned wire contracts for an authoritative online match.
 *
 * These schemas deliberately reject unknown fields. In particular, browser
 * commands cannot smuggle a simulation seed, a score, a match state, a reward
 * or an identity: all of those are derived from the authenticated session by
 * the Durable Object.
 */
export const MATCH_PROTOCOL_VERSION = 1 as const;

const ProtocolVersionSchema = z.literal(MATCH_PROTOCOL_VERSION);
const UuidSchema = z.string().uuid();
const EpochMillisecondsSchema = z.number().int().nonnegative();
const SignatureSchema = z
  .string()
  .trim()
  .min(16)
  .max(1024)
  .regex(/^[A-Za-z0-9_-]+$/, "signature must be base64url-safe");
const NonceSchema = z
  .string()
  .trim()
  .min(16)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/, "nonce must be base64url-safe");

export const MatchSeatSchema = z.enum(["home", "away"]);
export type MatchSeat = z.infer<typeof MatchSeatSchema>;

export const MatchTicketV1Schema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    userId: UuidSchema,
    seat: MatchSeatSchema,
    issuedAt: EpochMillisecondsSchema,
    expiresAt: EpochMillisecondsSchema,
    nonce: NonceSchema,
    signature: SignatureSchema,
  })
  .strict()
  .refine((ticket) => ticket.expiresAt > ticket.issuedAt, {
    message: "ticket expiresAt must be after issuedAt",
    path: ["expiresAt"],
  });

export type MatchTicketV1 = z.infer<typeof MatchTicketV1Schema>;

const FormationSchema = z.enum(["3-5-2", "4-2-3-1", "4-3-3", "4-4-2", "4-5-1", "5-3-2"]);
const MentalitySchema = z.enum(["defensive", "cautious", "balanced", "positive", "attacking"]);
const PressureSchema = z.enum(["low", "medium", "high"]);
const WidthSchema = z.enum(["narrow", "balanced", "wide"]);
const TempoSchema = z.enum(["slow", "balanced", "fast"]);
const LineHeightSchema = z.enum(["deep", "standard", "high"]);
const PlayerRoleSchema = z.enum([
  "goalkeeper",
  "fullback",
  "wingback",
  "centre_back",
  "holding_midfielder",
  "box_to_box",
  "playmaker",
  "wide_midfielder",
  "winger",
  "inside_forward",
  "striker",
]);
const PlayerReferenceSchema = z.string().trim().min(1).max(96);

/**
 * The first wire representation intentionally keeps tactics bounded. The
 * complete TacticalPlan expands this same shape later without opening an
 * unvalidated free-form object to online clients.
 */
export const TacticalCommandPayloadV1Schema = z
  .object({
    formation: FormationSchema,
    mentality: MentalitySchema,
    pressing: PressureSchema,
    width: WidthSchema,
    tempo: TempoSchema,
    lineHeight: LineHeightSchema,
    roles: z
      .array(
        z
          .object({
            playerId: PlayerReferenceSchema,
            role: PlayerRoleSchema,
          })
          .strict(),
      )
      .max(11)
      .optional(),
    inPossession: z
      .array(z.enum(["short_passes", "direct_passes", "overlap", "work_ball_into_box"]))
      .max(4)
      .optional(),
    outOfPossession: z
      .array(z.enum(["counter_press", "regroup", "offside_trap", "protect_box"]))
      .max(4)
      .optional(),
  })
  .strict();

export type TacticalCommandPayloadV1 = z.infer<typeof TacticalCommandPayloadV1Schema>;

const ReadyCommandSchema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    kind: z.literal("ready"),
    payload: z.object({ ready: z.literal(true) }).strict(),
  })
  .strict();

const SetTacticsCommandSchema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    kind: z.literal("set_tactics"),
    payload: TacticalCommandPayloadV1Schema,
  })
  .strict();

const SubstituteCommandSchema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    kind: z.literal("substitute"),
    payload: z
      .object({
        playerOut: PlayerReferenceSchema,
        playerIn: PlayerReferenceSchema,
      })
      .strict()
      .refine((substitution) => substitution.playerIn !== substitution.playerOut, {
        message: "substitution must contain two different players",
        path: ["playerIn"],
      }),
  })
  .strict();

const ForfeitCommandSchema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    kind: z.literal("forfeit"),
    payload: z.object({ confirmed: z.literal(true) }).strict(),
  })
  .strict();

const AcknowledgeSnapshotCommandSchema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    kind: z.literal("ack_snapshot"),
    payload: z.object({ revision: z.number().int().nonnegative() }).strict(),
  })
  .strict();

export const MatchCommandV1Schema = z.discriminatedUnion("kind", [
  ReadyCommandSchema,
  SetTacticsCommandSchema,
  SubstituteCommandSchema,
  ForfeitCommandSchema,
  AcknowledgeSnapshotCommandSchema,
]);

export type MatchCommandV1 = z.infer<typeof MatchCommandV1Schema>;
export type MatchCommandKind = MatchCommandV1["kind"];

const PublicScoreSchema = z
  .object({
    home: z.number().int().nonnegative().max(99),
    away: z.number().int().nonnegative().max(99),
  })
  .strict();

const PublicPossessionSchema = z
  .object({
    home: z.number().min(0).max(100),
    away: z.number().min(0).max(100),
  })
  .strict()
  .refine((possession) => Math.abs(possession.home + possession.away - 100) < 0.01, {
    message: "public possession must total 100",
  });

export const MatchPublicStateV1Schema = z
  .object({
    minute: z.number().int().min(0).max(130),
    score: PublicScoreSchema,
    possession: PublicPossessionSchema,
  })
  .strict();

export type MatchPublicStateV1 = z.infer<typeof MatchPublicStateV1Schema>;

export const PresentationEventV1Schema = z
  .object({
    id: z.string().trim().min(1).max(128),
    type: z.enum([
      "kickoff",
      "chance",
      "goal",
      "card",
      "substitution",
      "tactical_change",
      "half_time",
      "full_time",
    ]),
    tick: z.number().int().nonnegative(),
    team: MatchSeatSchema.optional(),
  })
  .strict();

export type PresentationEventV1 = z.infer<typeof PresentationEventV1Schema>;

export const MatchSnapshotV1Schema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    tick: z.number().int().nonnegative(),
    revision: z.number().int().nonnegative(),
    phase: z.enum(["waiting", "live", "reconnecting", "finalized"]),
    publicState: MatchPublicStateV1Schema,
    presentationEvents: z.array(PresentationEventV1Schema).max(64),
  })
  .strict();

export type MatchSnapshotV1 = z.infer<typeof MatchSnapshotV1Schema>;

const MatchResultSchema = z
  .object({
    homeGoals: z.number().int().nonnegative().max(99),
    awayGoals: z.number().int().nonnegative().max(99),
    winner: z.enum(["home", "away", "draw"]),
  })
  .strict()
  .superRefine((result, context) => {
    const expectedWinner =
      result.homeGoals === result.awayGoals
        ? "draw"
        : result.homeGoals > result.awayGoals
          ? "home"
          : "away";
    if (result.winner !== expectedWinner) {
      context.addIssue({
        code: "custom",
        message: "receipt winner must match the final score",
        path: ["winner"],
      });
    }
  });

export const MatchReceiptV1Schema = z
  .object({
    version: ProtocolVersionSchema,
    roomId: UuidSchema,
    simulationVersion: z.string().trim().min(1).max(128),
    commandHash: z.string().regex(/^[a-f0-9]{64}$/, "commandHash must be sha256 hex"),
    result: MatchResultSchema,
    closureReason: z.enum(["completed", "forfeit", "abandoned", "cancelled"]),
    idempotencyKey: UuidSchema,
    issuedAt: EpochMillisecondsSchema,
    signature: SignatureSchema,
  })
  .strict();

export type MatchReceiptV1 = z.infer<typeof MatchReceiptV1Schema>;

export function parseMatchTicketV1(input: unknown): MatchTicketV1 {
  return MatchTicketV1Schema.parse(input);
}

export function assertCurrentTicket(ticket: MatchTicketV1, now: number): MatchTicketV1 {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("ticket validation requires a non-negative epoch timestamp");
  }
  if (ticket.expiresAt <= now) {
    throw new Error("match ticket expired");
  }
  return ticket;
}

export function parseMatchCommandV1(input: unknown): MatchCommandV1 {
  return MatchCommandV1Schema.parse(input);
}

export function parseMatchSnapshotV1(input: unknown): MatchSnapshotV1 {
  return MatchSnapshotV1Schema.parse(input);
}

export function parseMatchReceiptV1(input: unknown): MatchReceiptV1 {
  return MatchReceiptV1Schema.parse(input);
}
