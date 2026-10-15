import { z } from "zod";

/** Persisted athlete JSON is untrusted, even when supplied by an authenticated account. */
const short = z.string().max(80);
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const percent = z.number().finite().min(0).max(100);
const line = z
  .object({
    season: integer,
    age: z.number().int().min(12).max(110),
    clubId: z.string().min(1).max(80),
    apps: integer,
    starts: integer,
    goals: integer,
    assists: integer,
    ratingSum: z.number().finite().nonnegative(),
    motm: integer,
  })
  .passthrough();

const match = z
  .object({
    week: integer,
    opponentId: z.string().min(1).max(80),
    home: z.boolean(),
    goalsFor: integer,
    goalsAgainst: integer,
    role: z.enum(["titular", "reserva", "fora"]),
    minutes: z.number().int().min(0).max(130),
    rating: z.number().finite().min(0).max(10).nullable(),
    goals: integer,
    assists: integer,
    reasons: z.array(short).max(32),
    motm: z.boolean(),
  })
  .passthrough();

const offered = z
  .object({
    id: z.string().min(1).max(160),
    clubId: z.string().min(1).max(80),
    salary: integer,
    years: z.number().int().min(1).max(15),
    loan: z.boolean(),
    negotiationRounds: z.number().int().min(0).max(1).optional(),
  })
  .passthrough();

const option = z
  .object({
    id: short,
    label: short,
    attr: short,
    risk: z.number().finite().min(0).max(1),
    reward: z.enum(["goal", "assist", "save", "tackle", "keep"]),
  })
  .passthrough();

export const AthleteSaveSchema = z
  .object({
    version: z.literal(1),
    slot: z.number().int().min(1).max(3),
    seed: z.string().min(1).max(200),
    name: z.string().min(1).max(40),
    nickname: z.string().min(1).max(40),
    nation: short,
    hometown: short,
    position: z.enum(["GOL", "ZAG", "LAT", "VOL", "MEI", "PON", "ATA"]),
    secondary: z.array(z.enum(["GOL", "ZAG", "LAT", "VOL", "MEI", "PON", "ATA"])).max(2),
    foot: z.enum(["direito", "esquerdo"]),
    weakFoot: z.number().int().min(1).max(5),
    heightCm: z.number().finite().min(100).max(250),
    weightKg: z.number().finite().min(25).max(250),
    build: z.enum(["leve", "atletico", "forte"]),
    personality: z.enum(["profissional", "ambicioso", "leal", "temperamental"]),
    origin: z.enum(["base", "peneira", "varzea"]),
    appearance: z
      .object({
        skin: integer,
        hair: integer,
        hairColor: integer,
        beard: integer,
        boots: integer,
      })
      .passthrough(),
    appearanceV1: z
      .object({
        version: z.literal(1),
        skinTone: integer,
        hairColor: integer,
        hairStyle: short,
        beardStyle: short,
        bootVariant: integer,
        bodyType: short,
      })
      .passthrough()
      .optional(),
    shirtNumber: z.number().int().min(0).max(99),
    age: z.number().int().min(12).max(110),
    season: z.number().int().min(1).max(100),
    week: z.number().int().min(1).max(130),
    leagueId: z.string().min(1).max(80),
    clubId: z.string().min(1).max(80),
    attrs: z.record(z.string().min(1).max(64), percent),
    potential: percent,
    potentialSeenRange: z.tuple([percent, percent]),
    traits: z.array(short).max(64),
    energy: percent,
    form: percent,
    morale: percent,
    trust: percent,
    chemistry: percent,
    injury: z
      .object({ label: short, weeksLeft: z.number().int().min(0).max(200) })
      .passthrough()
      .nullable(),
    contract: z
      .object({
        clubId: z.string().min(1).max(80),
        salary: integer,
        untilSeason: integer,
        goalBonus: integer,
        releaseClause: integer,
      })
      .passthrough(),
    money: z.number().finite(),
    followers: integer,
    reputation: percent,
    nationalCaps: integer,
    nationalGoals: integer,
    awards: z.array(short).max(200),
    current: line,
    history: z.array(line).max(150),
    lastMatch: match.nullable(),
    recent: z.array(match).max(20),
    news: z
      .array(
        z.object({
          id: short,
          season: integer,
          week: integer,
          title: z.string().max(400),
          tone: z.enum(["good", "bad", "neutral"]),
        }),
      )
      .max(100),
    offers: z.array(offered).max(12),
    pendingMoment: z
      .object({
        week: integer,
        moments: z
          .array(
            z.object({
              id: short,
              minute: z.number().int().min(0).max(130),
              prompt: z.string().max(600),
              options: z.array(option).min(1).max(10),
            }),
          )
          .max(12),
      })
      .nullable(),
    retired: z.boolean(),
    createdAt: integer,
    updatedAt: integer,
  })
  .passthrough();

export const AthleteMutationSchema = z
  .object({
    slot: z.number().int().min(1).max(3),
    expectedRevision: integer,
    state: AthleteSaveSchema,
  })
  .superRefine(({ slot, state }, context) => {
    if (slot !== state.slot) {
      context.addIssue({
        code: "custom",
        path: ["state", "slot"],
        message: "O espaço não corresponde ao atleta.",
      });
    }
  });

export const AthleteDeleteSchema = z.object({
  slot: z.number().int().min(1).max(3),
  expectedRevision: integer,
});

export const AthleteMutationResult = z
  .array(
    z.object({
      status: z.enum(["applied", "conflict"]),
      new_revision: integer,
    }),
  )
  .length(1);
