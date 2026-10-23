import { z } from "zod/mini";
import { FORMATIONS, FORMATION_KEYS } from "./formations";
import type { CareerState, FormationKey, Player, Position, Tactics } from "./types";
export const TACTICAL_PHASES = ["possession", "defending", "won", "lost"] as const;
export type TacticalPhase = (typeof TACTICAL_PHASES)[number];
export const ROLE_CATALOG = {
  goalkeeper: { label: "Goleiro", pos: "GK", x: 0, z: 0 },
  sweeper_keeper: { label: "Goleiro líbero", pos: "GK", x: 0.12, z: 0 },
  cover: { label: "Zagueiro de cobertura", pos: "DF", x: -0.08, z: 0 },
  stopper: { label: "Zagueiro de combate", pos: "DF", x: 0.08, z: 0 },
  ball_defender: { label: "Zagueiro construtor", pos: "DF", x: 0.04, z: 0 },
  fullback: { label: "Lateral", pos: "DF", x: 0.05, z: 0.04 },
  wingback: { label: "Ala", pos: "DF", x: 0.18, z: 0.1 },
  inverted_back: { label: "Lateral invertido", pos: "DF", x: 0.12, z: -0.22 },
  anchor: { label: "Volante", pos: "MF", x: -0.12, z: -0.05 },
  deep_playmaker: { label: "Organizador recuado", pos: "MF", x: -0.08, z: -0.05 },
  box_to_box: { label: "Meio de área a área", pos: "MF", x: 0.1, z: 0 },
  playmaker: { label: "Armador", pos: "MF", x: 0.06, z: -0.08 },
  mezzala: { label: "Mezzala", pos: "MF", x: 0.12, z: 0.16 },
  winger: { label: "Ponta", pos: "FW", x: 0.08, z: 0.12 },
  inside_forward: { label: "Atacante interior", pos: "FW", x: 0.14, z: -0.28 },
  striker: { label: "Centroavante", pos: "FW", x: 0.06, z: 0 },
  target: { label: "Pivô", pos: "FW", x: -0.06, z: -0.12 },
  false_nine: { label: "Falso nove", pos: "FW", x: -0.22, z: -0.1 },
  runner: { label: "Atacante de profundidade", pos: "FW", x: 0.2, z: 0.02 },
} as const;
export type TacticalRole = keyof typeof ROLE_CATALOG;
export const ROLE_DUTIES: Partial<
  Record<
    TacticalRole,
    readonly ["defend" | "support" | "attack", ...Array<"defend" | "support" | "attack">]
  >
> = {
  goalkeeper: ["defend"],
  sweeper_keeper: ["defend", "support"],
  cover: ["defend"],
  stopper: ["defend"],
  ball_defender: ["defend", "support"],
  anchor: ["defend", "support"],
  deep_playmaker: ["defend", "support"],
  box_to_box: ["support", "attack"],
  playmaker: ["support", "attack"],
  mezzala: ["support", "attack"],
  winger: ["support", "attack"],
  inside_forward: ["support", "attack"],
  striker: ["support", "attack"],
  target: ["support", "attack"],
  false_nine: ["support", "attack"],
  runner: ["support", "attack"],
};
export function roleDuties(roleName: TacticalRole): readonly ("defend" | "support" | "attack")[] {
  return ROLE_DUTIES[roleName] ?? ["defend", "support", "attack"];
}
export function roleFamiliarityKey(id: string, roleName: TacticalRole) {
  return `role:${roleName}:${id.slice(0, 110)}`;
}
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
        const position = FORMATIONS[p.formation][s.slot]!.pos;
        const rp = ROLE_CATALOG[s.role].pos;
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
export interface TacticalChangeEvent {
  minute: number;
  side: "home" | "away";
  planId: string;
  name: string;
  reason: "rule" | "manual" | "resume";
  ruleId?: string | undefined;
}
export interface TacticalRuntimeState {
  activePlanId: string;
  lastAutomaticAt: number;
  lastEvaluationMinute: number;
  signature: string;
  manualOverride: boolean;
}
export const PHASE_LABELS: Record<TacticalPhase, string> = {
  possession: "Com bola",
  defending: "Sem bola",
  won: "Recuperação",
  lost: "Perda",
};
export const DUTY_LABELS = { defend: "Defender", support: "Apoiar", attack: "Atacar" };
export function defaultRole(pos: Position, zAxis = 0): TacticalRole {
  return pos === "GK"
    ? "goalkeeper"
    : pos === "DF"
      ? Math.abs(zAxis) > 0.6
        ? "fullback"
        : "cover"
      : pos === "MF"
        ? "box_to_box"
        : Math.abs(zAxis) > 0.5
          ? "winger"
          : "striker";
}
export function createPlan(t: Tactics, id = "principal", name = "Plano principal"): TacticalPlanV2 {
  return {
    version: 2,
    id,
    name,
    formation: t.formation,
    mentality: t.mentality,
    possession: {
      passing: 1,
      risk: 1,
      tempo: t.tempo,
      width: t.width,
      buildUp: "mixed",
      focus: "balanced",
      overlap: false,
      runs: true,
      crosses: 1,
      shooting: 1,
    },
    defending: {
      line: 1,
      pressLine: t.pressing,
      pressing: t.pressing,
      compactness: 1,
      trigger: "always",
      show: "balanced",
      marking: "zone",
      offside: false,
    },
    transitions: { loss: "regroup", win: "hold", keeper: "mixed" },
    players: FORMATIONS[t.formation].map((s, slot) => {
      const r = defaultRole(s.pos, s.z);
      return {
        slot,
        role: r,
        duty: roleDuties(r).includes("support") ? "support" : "defend",
        freedom: 1,
        dribble: 1,
        risk: 1,
        pressing: 1,
        marking: "zone",
        positions: {
          possession: { x: 0, z: 0 },
          defending: { x: 0, z: 0 },
          won: { x: 0, z: 0 },
          lost: { x: 0, z: 0 },
        },
      };
    }),
    opposition: [],
    setPieces: {
      corners: [],
      freeKicks: [],
      penalties: [],
      target: "centre",
      marking: "zone",
      stayBack: 2,
    },
  };
}
export function activateAdvanced(t: Tactics): Tactics {
  if (t.advanced) return t;
  const p = createPlan(t);
  return {
    ...t,
    advanced: {
      version: 2,
      plans: [p],
      activePlanId: p.id,
      rules: [],
      automation: false,
      familiarity: {
        team: 50,
        phases: { possession: 50, defending: 50, won: 50, lost: 50 },
        roles: {},
        played: [],
      },
    },
  };
}
export function activePlan(t: Tactics): TacticalPlanV2 | undefined {
  return t.advanced?.plans.find((p) => p.id === t.advanced!.activePlanId);
}
export function withPlan(t: Tactics, p: TacticalPlanV2): Tactics {
  if (!t.advanced) return t;
  return {
    ...t,
    formation: p.formation,
    mentality: p.mentality,
    width: p.possession.width,
    tempo: p.possession.tempo,
    pressing: p.defending.pressing,
    advanced: {
      ...t.advanced,
      activePlanId: p.id,
      plans: t.advanced.plans.map((old) => (old.id === p.id ? p : old)),
    },
  };
}
export const TACTICAL_PRESETS = [
  "Posse",
  "Jogo direto",
  "Contra-ataque",
  "Pressão alta",
  "Bloco baixo",
  "Pelos lados",
] as const;
export function presetPlan(
  t: Tactics,
  style: (typeof TACTICAL_PRESETS)[number],
  id: string,
): TacticalPlanV2 {
  const p = createPlan(t, id, style);
  if (style === "Posse") {
    p.possession.passing = 0;
    p.possession.tempo = 0;
    p.possession.buildUp = "short";
    p.possession.shooting = 0;
  }
  if (style === "Jogo direto") {
    p.possession.passing = 2;
    p.possession.buildUp = "direct";
    p.transitions.keeper = "long";
    p.possession.crosses = 2;
  }
  if (style === "Contra-ataque") {
    p.mentality = 1;
    p.defending.line = 0;
    p.transitions.win = "counter";
    p.possession.tempo = 2;
    p.possession.passing = 2;
  }
  if (style === "Pressão alta") {
    p.mentality = 3;
    p.defending.line = 2;
    p.defending.pressing = 2;
    p.defending.pressLine = 2;
    p.transitions.loss = "counterpress";
    p.possession.tempo = 2;
  }
  if (style === "Bloco baixo") {
    p.mentality = 1;
    p.defending.line = 0;
    p.defending.pressLine = 0;
    p.defending.pressing = 0;
    p.defending.compactness = 2;
  }
  if (style === "Pelos lados") {
    p.possession.width = 2;
    p.possession.overlap = true;
    p.possession.crosses = 2;
  }
  return p;
}
export function tacticalWarnings(p: TacticalPlanV2): string[] {
  const warnings: string[] = [];
  if (p.defending.line === 0 && p.defending.pressLine === 2)
    warnings.push("Pressão alta com linha baixa abre espaço entre os setores.");
  if (p.possession.tempo === 2 && p.possession.risk === 2)
    warnings.push("Ritmo e risco elevados aumentam perdas e desgaste.");
  if (p.defending.line === 2 && !p.defending.offside)
    warnings.push("Linha alta precisa de cobertura para corridas nas costas.");
  if (p.players.filter((s) => s.duty === "attack").length > 5)
    warnings.push("Muitos jogadores atacando deixam pouca proteção na perda.");
  return warnings;
}
export function roleFit(p: Player, roleName: TacticalRole): number {
  const r = ROLE_CATALOG[roleName];
  const natural = p.pos === r.pos ? 1 : p.pos !== "GK" && r.pos !== "GK" ? 0.74 : 0.35;
  const quality =
    r.pos === "GK"
      ? (p.defending + p.physical) / 2
      : ["playmaker", "deep_playmaker", "ball_defender"].includes(roleName)
        ? p.passing * 0.65 + p.defending * 0.35
        : r.pos === "DF"
          ? p.defending * 0.6 + p.pace * 0.2 + p.physical * 0.2
          : r.pos === "FW"
            ? p.shooting * 0.45 + p.pace * 0.35 + p.physical * 0.2
            : (p.passing + p.pace + p.physical) / 3;
  return Math.round(quality * natural);
}
export function tacticalSignature(t: Tactics): string {
  return `${t.formation}:${t.mentality}:${t.pressing}:${t.width}:${t.tempo}:${t.advanced?.activePlanId ?? ""}`;
}
/** Commands always suspend automatic rules, including changes to legacy sliders. */
export function manualTactics(
  t: Tactics,
  patch: Partial<Pick<Tactics, "mentality" | "pressing" | "width" | "tempo">> = {},
): Tactics {
  const p = activePlan(t);
  if (!p || !t.advanced) return { ...t, ...patch };
  const next = withPlan(t, {
    ...p,
    mentality: patch.mentality ?? p.mentality,
    possession: {
      ...p.possession,
      width: patch.width ?? p.possession.width,
      tempo: patch.tempo ?? p.possession.tempo,
    },
    defending: { ...p.defending, pressing: patch.pressing ?? p.defending.pressing },
  });
  return { ...next, advanced: { ...next.advanced!, automation: false } };
}
export function evaluateRules(
  t: Tactics,
  state: TacticalRuntimeState,
  context: {
    minute: number;
    goals: number;
    opponents: number;
    players: number;
    opponentPlayers: number;
    condition: number;
  },
  force = false,
): TacticalChangeEvent | undefined {
  const program = t.advanced;
  if (!program || !program.automation || state.manualOverride) return;
  if (!force && state.lastEvaluationMinute === context.minute) return;
  state.lastEvaluationMinute = context.minute;
  if (context.minute - state.lastAutomaticAt < 5) return;
  const delta = context.goals - context.opponents;
  const rule = program.rules
    .filter(
      (r) =>
        r.enabled &&
        context.minute >= r.minute &&
        (r.score === "any" ||
          (r.score === "losing" && delta < 0) ||
          (r.score === "drawing" && delta === 0) ||
          (r.score === "winning" && delta > 0)) &&
        (!r.fewerPlayers || context.players < context.opponentPlayers) &&
        (r.conditionBelow === 0 || context.condition < r.conditionBelow),
    )
    // Ordinal IDs keep equal-priority decisions independent of host locale.
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  const plan = rule && program.plans.find((p) => p.id === rule.planId);
  if (!plan || !rule || plan.id === state.activePlanId) return;
  state.activePlanId = plan.id;
  state.lastAutomaticAt = context.minute;
  return {
    minute: context.minute,
    side: "home",
    planId: plan.id,
    name: plan.name,
    reason: "rule",
    ruleId: rule.id,
  };
}
/** Pure coefficients shared by spatial and compact simulations. Never changes RNG. */
export function tacticalEffects(t: Tactics) {
  const p = activePlan(t);
  if (!p) return { attack: 1, exposure: 1, fatigue: 1, execution: 1 };
  const familiar = t.advanced!.familiarity.team;
  const execution = 0.82 + familiar * 0.0018 - tacticalWarnings(p).length * 0.025;
  const individual =
    p.players
      .slice(1)
      .reduce(
        (n, s) =>
          n +
          (s.duty === "attack" ? 0.025 : s.duty === "defend" ? -0.02 : 0) +
          (s.risk - 1) * 0.008 +
          (s.dribble - 1) * 0.006 +
          (s.freedom - 1) * 0.004 +
          (s.pressing - 1) * 0.003 +
          (s.marking === "man" ? 0.002 : 0) +
          s.positions.possession.x * 0.02 -
          s.positions.defending.x * 0.01,
        0,
      ) / 10;
  // Small, bounded tradeoffs: more aggression also increases exposure and cost.
  const aggression =
    (p.possession.passing - 1) * 0.012 +
    (p.possession.tempo - 1) * 0.014 +
    (p.possession.width - 1) * 0.008 +
    (p.possession.crosses - 1) * 0.008 +
    (p.possession.buildUp === "direct" ? 0.012 : p.possession.buildUp === "short" ? -0.008 : 0) +
    (p.possession.focus === "balanced" ? 0 : 0.004) +
    (p.possession.overlap ? 0.012 : 0) +
    (p.possession.runs ? 0.008 : 0) +
    (p.transitions.win === "counter" ? 0.012 : -0.004) +
    (p.transitions.keeper === "long" ? 0.004 : p.transitions.keeper === "short" ? -0.003 : 0) +
    individual;
  const pressure =
    (p.defending.pressLine - 1) * 0.008 +
    p.defending.pressing * 0.006 +
    (p.defending.trigger === "always" ? 0.006 : -0.002) +
    (p.transitions.loss === "counterpress" ? 0.008 : -0.004);
  const cover =
    p.defending.compactness * 0.009 +
    (p.defending.offside ? 0.005 : 0) +
    (p.defending.marking === "man" ? -0.004 : 0.004) +
    (p.defending.show === "balanced" ? 0 : 0.003) +
    p.opposition.reduce(
      (n, s) =>
        n +
        s.pressing * 0.002 +
        (s.marking === "man" ? 0.001 : 0) +
        (s.show === "balanced" ? 0 : 0.001),
      0,
    );
  return {
    execution,
    attack: Math.max(
      0.75,
      Math.min(
        1.25,
        (1 +
          (p.mentality - 2) * 0.035 +
          (p.possession.risk - 1) * 0.025 +
          (p.possession.shooting - 1) * 0.018 +
          aggression +
          pressure) *
          execution,
      ),
    ),
    exposure: Math.max(
      0.8,
      Math.min(
        1.3,
        1 +
          (p.defending.line - 1) * 0.04 +
          (p.possession.risk - 1) * 0.035 +
          aggression +
          pressure -
          cover +
          tacticalWarnings(p).length * 0.025,
      ),
    ),
    fatigue:
      1 +
      p.defending.pressing * 0.1 +
      p.possession.tempo * 0.06 +
      (p.transitions.loss === "counterpress" ? 0.1 : 0),
  };
}
export function phasePosition(
  t: Tactics,
  slotIndex: number,
  phase: TacticalPhase,
  skill = 70,
  roleFamiliar = 50,
) {
  const p = activePlan(t);
  if (!p) return undefined;
  const s = p.players.find((v) => v.slot === slotIndex);
  if (!s) return undefined;
  const base = FORMATIONS[p.formation][slotIndex]!;
  const offsets = s.positions[phase];
  const r = ROLE_CATALOG[s.role];
  const attacking = phase === "possession" || phase === "won";
  const learned = (t.advanced!.familiarity.phases[phase] + t.advanced!.familiarity.team) / 200;
  const scale = (0.65 + learned * 0.35) * (0.7 + skill * 0.003) * (0.85 + roleFamiliar * 0.003);
  const duty = s.duty === "attack" ? 0.1 : s.duty === "defend" ? -0.08 : 0;
  let x = base.x + offsets.x + (attacking ? r.x + duty : (p.defending.line - 1) * 0.12);
  let zAxis = base.z + offsets.z + (attacking ? Math.sign(base.z) * r.z : 0);
  if (attacking && p.possession.overlap && s.role === "fullback") x += 0.12;
  if (phase === "won" && p.transitions.win === "counter") x += 0.1;
  if (phase === "lost" && p.transitions.loss === "regroup") x -= 0.12;
  zAxis *= attacking ? 0.8 + p.possession.width * 0.1 : 1 - p.defending.compactness * 0.1;
  if (slotIndex === 0) {
    x = Math.min(-0.65, x);
    zAxis = Math.max(-0.2, Math.min(0.2, zAxis));
  }
  const zone =
    base.pos === "GK"
      ? [-0.96, -0.65]
      : base.pos === "DF"
        ? [-0.85, 0.15]
        : base.pos === "MF"
          ? [-0.5, 0.62]
          : [-0.12, 0.87];
  return {
    x: Math.max(zone[0]!, Math.min(zone[1]!, base.x + (x - base.x) * scale)),
    z: Math.max(-0.95, Math.min(0.95, zAxis)),
    player: s,
  };
}
export function learnTactics(
  state: CareerState,
  source: "training" | "match",
  key: string,
  participants?: readonly {
    playerId: string;
    role?: TacticalRole | undefined;
    minutes: number;
  }[],
): CareerState {
  const program = state.tactics.advanced;
  if (!program) return state;
  const f = program.familiarity;
  if (
    (source === "training" && f.trainedRound === key) ||
    (source === "match" && f.played.includes(key))
  )
    return state;
  const gain = source === "training" ? 3 : 1;
  const ownedIds = Object.values(state.players)
    .filter((p) => p.clubId === state.clubId)
    .map((p) => p.id);
  const roles = Object.fromEntries(
    Object.entries(f.roles)
      .filter(
        ([id]) =>
          !!state.players[id] ||
          ownedIds.some((pid) =>
            Object.keys(ROLE_CATALOG).some(
              (r) => id === roleFamiliarityKey(pid, r as TacticalRole),
            ),
          ),
      )
      .slice(-178),
  );
  const current = activePlan(state.tactics)!;
  const played =
    participants ??
    state.lineup.map((playerId, index) => ({
      playerId,
      role: current.players.find((s) => s.slot === index)?.role,
      minutes: 90,
    }));
  for (const participant of played.slice(0, 32)) {
    const player = state.players[participant.playerId];
    if (
      !player ||
      player.clubId !== state.clubId ||
      participant.minutes <= 0 ||
      (source === "training" && player.injuryWeeks > 0)
    )
      continue;
    const learned = gain * (source === "match" ? Math.min(1, participant.minutes / 90) : 1);
    roles[player.id] = Math.min(100, (f.roles[player.id] ?? 50) + learned);
    const role =
      participant.role ?? current.players.find((s) => state.lineup[s.slot] === player.id)?.role;
    if (role) {
      const roleKey = roleFamiliarityKey(player.id, role);
      roles[roleKey] = Math.min(100, (f.roles[roleKey] ?? 50) + learned);
    }
  }
  return {
    ...state,
    tactics: {
      ...state.tactics,
      advanced: {
        ...program,
        familiarity: {
          ...f,
          team: Math.min(100, f.team + gain),
          phases: {
            possession: Math.min(100, f.phases.possession + gain),
            defending: Math.min(100, f.phases.defending + gain),
            won: Math.min(100, f.phases.won + gain),
            lost: Math.min(100, f.phases.lost + gain),
          },
          roles: Object.fromEntries(Object.entries(roles).slice(-200)),
          ...(source === "training"
            ? { trainedRound: key }
            : { played: [...f.played, key].slice(-100) }),
        },
      },
    },
  };
}
/** CPU chooses using its own public squad only; no human plan or hidden attributes. */
export function opponentProgram(
  t: Tactics,
  players: Pick<Player, "pace" | "passing" | "defending" | "shooting" | "physical">[],
): Tactics {
  const avg = (key: "pace" | "passing" | "defending") =>
    players.reduce((n, p) => n + p[key], 0) / Math.max(1, players.length);
  const style =
    avg("passing") >= avg("pace")
      ? "Posse"
      : avg("defending") >= avg("passing")
        ? "Contra-ataque"
        : "Pelos lados";
  const enabled = activateAdvanced(t);
  const principal = presetPlan(t, style, "cpu-principal");
  const protect = presetPlan(t, "Bloco baixo", "cpu-proteger");
  const chase = presetPlan(t, "Pressão alta", "cpu-buscar");
  return withPlan(
    {
      ...enabled,
      advanced: {
        ...enabled.advanced!,
        activePlanId: principal.id,
        plans: [principal, protect, chase],
        automation: true,
        rules: [
          {
            id: "cpu-proteger",
            enabled: true,
            priority: 20,
            planId: protect.id,
            minute: 70,
            score: "winning",
            fewerPlayers: false,
            conditionBelow: 0,
          },
          {
            id: "cpu-buscar",
            enabled: true,
            priority: 30,
            planId: chase.id,
            minute: 60,
            score: "losing",
            fewerPlayers: false,
            conditionBelow: 0,
          },
        ],
      },
    },
    principal,
  );
}
export function saveAdvancedPlan(t: Tactics, plan: TacticalPlanV2): Tactics {
  const enabled = activateAdvanced(t);
  const previous = activePlan(enabled)!;
  const changes =
    previous.formation !== plan.formation
      ? 12
      : previous.players.filter(
          (s, i) => s.role !== plan.players[i]?.role || s.duty !== plan.players[i]?.duty,
        ).length;
  const next = withPlan(enabled, plan);
  if (!next.advanced) return next;
  return {
    ...next,
    advanced: {
      ...next.advanced,
      familiarity: {
        ...next.advanced.familiarity,
        team: Math.max(25, next.advanced.familiarity.team - changes),
      },
    },
  };
}
