import { z } from "zod/mini";
import type { CareerMatchAnalytics } from "./match-analytics";

const finite = z.number().check(z.minimum(0)).check(z.maximum(1e6));
const summarySchema = z.strictObject({
  id: z.string().check(z.maxLength(200)),
  season: finite,
  round: finite,
  home: z.string().check(z.maxLength(160)),
  away: z.string().check(z.maxLength(160)),
  source: z.enum(["spatial", "quick"]),
  score: z.tuple([finite, finite]),
  xg: z.tuple([finite, finite]),
  possession: z.tuple([
    z.number().check(z.minimum(0)).check(z.maximum(100)),
    z.number().check(z.minimum(0)).check(z.maximum(100)),
  ]),
  passes: z.tuple([finite, finite]),
  changes: z
    .array(
      z.strictObject({
        minute: finite,
        side: z.enum(["home", "away"]),
        planId: z.string().check(z.maxLength(160)),
        name: z.string().check(z.maxLength(60)),
        reason: z.enum(["rule", "manual", "resume"]),
        ruleId: z.optional(z.string().check(z.maxLength(160))),
      }),
    )
    .check(z.maxLength(40)),
});
export function repairMatchAnalytics(value: unknown): CareerMatchAnalytics[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: CareerMatchAnalytics[] = [];
  for (const raw of value.slice(0, 100)) {
    const p = summarySchema.safeParse(raw);
    if (p.success && !seen.has(p.data.id)) {
      seen.add(p.data.id);
      out.push(p.data);
    }
  }
  return out;
}
