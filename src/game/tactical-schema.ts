import { z } from "zod/mini";
import { FORMATIONS, FORMATION_KEYS } from "./formations";
import type { FormationKey } from "./types";
import { ROLE_CATALOG, roleDuties, type TacticalRole } from "./tactical-plan";

const level = z.int().check(z.minimum(0)).check(z.maximum(2));
const signed = z.number().check(z.minimum(-0.2)).check(z.maximum(0.2));
const reference = z
  .string()
  .check(z.minLength(1))
  .check(z.maxLength(160))
  .check(z.refine((v) => !["__proto__", "constructor", "prototype"].includes(v)));
const role = z.enum(Object.keys(ROLE_CATALOG) as [TacticalRole, ...TacticalRole[]]);
export const TacticalPlayerSchema = z.strictObject({
  slot: z.int().check(z.minimum(0)).check(z.maximum(10)),
  role,
  duty: z.enum(["defend", "support", "attack"]),
  freedom: level,
  dribble: level,
  risk: level,
  pressing: level,
  marking: z.enum(["zone", "man"]),
  positions: z.strictObject({
    possession: z.object({ x: signed, z: signed }),
    defending: z.object({ x: signed, z: signed }),
    won: z.object({ x: signed, z: signed }),
    lost: z.object({ x: signed, z: signed }),
  }),
});
export const TacticalPlanV2Schema = z
  .strictObject({
    version: z.literal(2),
    id: reference,
    name: z.string().check(z.minLength(1)).check(z.maxLength(60)),
    formation: z.enum(FORMATION_KEYS as [FormationKey, ...FormationKey[]]),
    mentality: z.int().check(z.minimum(0)).check(z.maximum(4)),
    possession: z.strictObject({
      passing: level,
      risk: level,
      tempo: level,
      width: level,
      buildUp: z.enum(["short", "mixed", "direct"]),
      focus: z.enum(["balanced", "left", "right", "centre"]),
      overlap: z.boolean(),
      runs: z.boolean(),
      crosses: level,
      shooting: level,
    }),
    defending: z.strictObject({
      line: level,
      pressLine: level,
      pressing: level,
      compactness: level,
      trigger: z.enum(["always", "backpass", "wide"]),
      show: z.enum(["balanced", "outside", "inside"]),
      marking: z.enum(["zone", "man"]),
      offside: z.boolean(),
    }),
    transitions: z.strictObject({
      loss: z.enum(["counterpress", "regroup"]),
      win: z.enum(["counter", "hold"]),
      keeper: z.enum(["short", "mixed", "long"]),
    }),
    players: z.array(TacticalPlayerSchema).check(z.length(11)),
    opposition: z
      .array(
        z.strictObject({
          playerId: reference,
          pressing: level,
          marking: z.enum(["zone", "man"]),
          show: z.enum(["balanced", "outside", "inside"]),
        }),
      )
      .check(z.maxLength(11)),
    setPieces: z.strictObject({
      corners: z.array(reference).check(z.maxLength(3)),
      freeKicks: z.array(reference).check(z.maxLength(3)),
      penalties: z.array(reference).check(z.maxLength(3)),
      target: z.enum(["near", "centre", "far", "short"]),
      marking: z.enum(["zone", "man"]),
      stayBack: z.int().check(z.minimum(1)).check(z.maximum(4)),
    }),
  })
  .check(
    z.superRefine((p, ctx) => {
      if (new Set(p.players.map((s) => s.slot)).size !== 11)
        ctx.addIssue({ code: "custom", message: "Eleven unique slots required" });
      for (const s of p.players) {
        // Numeric bound failures are continuable in Zod: refinements can see
        // an invalid slot and must report an issue instead of throwing.
        const position = FORMATIONS[p.formation]?.[s.slot]?.pos;
        const rp = ROLE_CATALOG[s.role]?.pos;
        if (!position || !rp) {
          ctx.addIssue({ code: "custom", message: "Unknown slot or role" });
          continue;
        }
        if (
          (position === "GK") !== (rp === "GK") ||
          (position === "DF" && rp !== "DF") ||
          (position === "FW" && rp !== "FW")
        )
          ctx.addIssue({ code: "custom", message: "Role incompatible with slot" });
        if (!roleDuties(s.role).includes(s.duty))
          ctx.addIssue({ code: "custom", message: "Duty incompatible with role" });
      }
    }),
  );
export type TacticalPlanV2 = z.infer<typeof TacticalPlanV2Schema>;
export type TacticalPlayer = z.infer<typeof TacticalPlayerSchema>;
export const TacticalRuleSchema = z.strictObject({
  id: reference,
  enabled: z.boolean(),
  priority: z.int().check(z.minimum(0)).check(z.maximum(99)),
  planId: reference,
  minute: z.int().check(z.minimum(0)).check(z.maximum(120)),
  score: z.enum(["any", "losing", "drawing", "winning"]),
  fewerPlayers: z.boolean(),
  conditionBelow: z.number().check(z.minimum(0)).check(z.maximum(100)),
});
export type TacticalRule = z.infer<typeof TacticalRuleSchema>;
export const TacticalProgramSchema = z
  .strictObject({
    version: z.literal(2),
    plans: z.array(TacticalPlanV2Schema).check(z.minLength(1)).check(z.maxLength(5)),
    activePlanId: reference,
    rules: z.array(TacticalRuleSchema).check(z.maxLength(8)),
    automation: z.boolean(),
    familiarity: z.strictObject({
      team: z.number().check(z.minimum(0)).check(z.maximum(100)),
      phases: z.strictObject({
        possession: z.number().check(z.minimum(0)).check(z.maximum(100)),
        defending: z.number().check(z.minimum(0)).check(z.maximum(100)),
        won: z.number().check(z.minimum(0)).check(z.maximum(100)),
        lost: z.number().check(z.minimum(0)).check(z.maximum(100)),
      }),
      roles: z
        .record(reference, z.number().check(z.minimum(0)).check(z.maximum(100)))
        .check(z.refine((v) => Object.keys(v).length <= 200)),
      trainedRound: z.optional(z.string().check(z.maxLength(32))),
      played: z.array(z.string().check(z.maxLength(120))).check(z.maxLength(100)),
    }),
  })
  .check(
    z.superRefine((v, ctx) => {
      const ids = new Set(v.plans.map((p) => p.id));
      if (
        ids.size !== v.plans.length ||
        !ids.has(v.activePlanId) ||
        v.rules.some((r) => !ids.has(r.planId)) ||
        new Set(v.rules.map((r) => r.id)).size !== v.rules.length
      )
        ctx.addIssue({ code: "custom", message: "Invalid or duplicate plan references" });
    }),
  );
export type TacticalProgramV2 = z.infer<typeof TacticalProgramSchema>;
