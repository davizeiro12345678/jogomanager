import { FORMATIONS, FORMATION_KEYS } from "./formations";
import { ROLE_CATALOG, roleDuties, type TacticalProgramV2 } from "./tactical-plan";

// Worker boundary guards short-circuit before walking oversized collections.
// Keep Zod's rich repair/import schemas outside the simulation dependency graph.
type Guard = (value: unknown) => boolean;
const number =
  (min: number, max: number, integer = false): Guard =>
  (value) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isSafeInteger(value));
const string =
  (min: number, max: number): Guard =>
  (value) =>
    typeof value === "string" && value.length >= min && value.length <= max;
const choices =
  (values: readonly unknown[]): Guard =>
  (value) =>
    values.includes(value);
const bool: Guard = (value) => typeof value === "boolean";
const reference: Guard = (value) =>
  string(1, 160)(value) &&
  value !== "__proto__" &&
  value !== "constructor" &&
  value !== "prototype";
const array =
  (guard: Guard, min: number, max: number): Guard =>
  (value) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) return false;
    for (let i = 0; i < value.length; i++) if (!guard(value[i])) return false;
    return true;
  };
const record =
  (key: Guard, item: Guard, max: number): Guard =>
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const entries = Object.keys(value);
    if (entries.length > max) return false;
    return entries.every((name) => key(name) && item((value as Record<string, unknown>)[name]));
  };
const object = (shape: Record<string, Guard>, strict = true): Guard => {
  const keys = Object.keys(shape);
  const allowed = new Set(keys);
  return (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (strict && Object.keys(value).some((key) => !allowed.has(key))) return false;
    return keys.every((key) => shape[key]!((value as Record<string, unknown>)[key]));
  };
};
const optional =
  (guard: Guard): Guard =>
  (value) =>
    value === undefined || guard(value);
const level = number(0, 2, true);
const marking = choices(["zone", "man"]);
const show = choices(["balanced", "outside", "inside"]);
const coordinate = object({ x: number(-0.2, 0.2), z: number(-0.2, 0.2) }, false);
const player = object({
  slot: number(0, 10, true),
  role: choices(Object.keys(ROLE_CATALOG)),
  duty: choices(["defend", "support", "attack"]),
  freedom: level,
  dribble: level,
  risk: level,
  pressing: level,
  marking,
  positions: object({
    possession: coordinate,
    defending: coordinate,
    won: coordinate,
    lost: coordinate,
  }),
});
const plan = object({
  version: choices([2]),
  id: reference,
  name: string(1, 60),
  formation: choices(FORMATION_KEYS),
  mentality: number(0, 4, true),
  possession: object({
    passing: level,
    risk: level,
    tempo: level,
    width: level,
    buildUp: choices(["short", "mixed", "direct"]),
    focus: choices(["balanced", "left", "right", "centre"]),
    overlap: bool,
    runs: bool,
    crosses: level,
    shooting: level,
  }),
  defending: object({
    line: level,
    pressLine: level,
    pressing: level,
    compactness: level,
    trigger: choices(["always", "backpass", "wide"]),
    show,
    marking,
    offside: bool,
  }),
  transitions: object({
    loss: choices(["counterpress", "regroup"]),
    win: choices(["counter", "hold"]),
    keeper: choices(["short", "mixed", "long"]),
  }),
  players: array(player, 11, 11),
  opposition: array(object({ playerId: reference, pressing: level, marking, show }), 0, 11),
  setPieces: object({
    corners: array(reference, 0, 3),
    freeKicks: array(reference, 0, 3),
    penalties: array(reference, 0, 3),
    target: choices(["near", "centre", "far", "short"]),
    marking,
    stayBack: number(1, 4, true),
  }),
});
const rule = object({
  id: reference,
  enabled: bool,
  priority: number(0, 99, true),
  planId: reference,
  minute: number(0, 120, true),
  score: choices(["any", "losing", "drawing", "winning"]),
  fewerPlayers: bool,
  conditionBelow: number(0, 100),
});
const familiarity = number(0, 100);
const program = object({
  version: choices([2]),
  plans: array(plan, 1, 5),
  activePlanId: reference,
  rules: array(rule, 0, 8),
  automation: bool,
  familiarity: object({
    team: familiarity,
    phases: object({
      possession: familiarity,
      defending: familiarity,
      won: familiarity,
      lost: familiarity,
    }),
    roles: record(reference, familiarity, 200),
    trainedRound: optional(string(0, 32)),
    played: array(string(0, 120), 0, 100),
  }),
});

/** Acceptance parity with TacticalProgramSchema, exercised by differential tests. */
export function validTacticalProgram(value: unknown): value is TacticalProgramV2 {
  if (!program(value)) return false;
  const v = value as TacticalProgramV2;
  const ids = new Set(v.plans.map((p) => p.id));
  if (
    ids.size !== v.plans.length ||
    !ids.has(v.activePlanId) ||
    v.rules.some((r) => !ids.has(r.planId)) ||
    new Set(v.rules.map((r) => r.id)).size !== v.rules.length
  )
    return false;
  return v.plans.every((p) => {
    if (new Set(p.players.map((s) => s.slot)).size !== 11) return false;
    return p.players.every((s) => {
      const position = FORMATIONS[p.formation][s.slot]!.pos;
      const rp = ROLE_CATALOG[s.role].pos;
      return (
        !(
          (position === "GK") !== (rp === "GK") ||
          (position === "DF" && rp !== "DF") ||
          (position === "FW" && rp !== "FW")
        ) && roleDuties(s.role).includes(s.duty)
      );
    });
  });
}
