import { repairMatchAnalytics } from "./match-analytics-repair";
import { TacticalProgramSchema } from "./tactical-schema";
import { describe, expect, it } from "vitest";
import { FORMATIONS, FORMATION_KEYS } from "./formations";
import { initCareer } from "./career";
import { autoWeek } from "./autoplay";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { snapshotMatch, resultMatch } from "./live-match";
import {
  activePlan,
  activateAdvanced,
  createPlan,
  evaluateRules,
  learnTactics,
  manualTactics,
  opponentProgram,
  phasePosition,
  presetPlan,
  tacticalEffects,
  tacticalSignature,
  withPlan,
  type TacticalRuntimeState,
} from "./tactical-plan";
import { advancedQuickScore } from "./tactical-quick-sim";
import {
  analyticsSnapshot,
  appendMatchAnalytics,
  createMatchAnalytics,
  recordPass,
  sampleAnalytics,
} from "./match-analytics";
import { validMatchCommand, validMatchTactics } from "./match-command-validation";

const legacy = { formation: "4-3-3" as const, mentality: 2, pressing: 1, width: 1, tempo: 1 };
const context = {
  minute: 60,
  goals: 0,
  opponents: 1,
  players: 11,
  opponentPlayers: 11,
  condition: 70,
};
function program() {
  const t = activateAdvanced(legacy);
  const main = activePlan(t)!;
  const chase = presetPlan(t, "Pressão alta", "buscar");
  const cover = presetPlan(t, "Bloco baixo", "cobrir");
  t.advanced!.plans = [main, chase, cover];
  t.advanced!.automation = true;
  t.advanced!.rules = [
    {
      id: "buscar",
      planId: "buscar",
      priority: 90,
      enabled: true,
      minute: 60,
      score: "losing",
      fewerPlayers: false,
      conditionBelow: 0,
    },
    {
      id: "cobrir",
      planId: "cobrir",
      priority: 10,
      enabled: true,
      minute: 0,
      score: "any",
      fewerPlayers: true,
      conditionBelow: 0,
    },
  ];
  return t;
}
function runtime(t = program()): TacticalRuntimeState {
  return {
    activePlanId: t.advanced!.activePlanId,
    lastAutomaticAt: -5,
    lastEvaluationMinute: -1,
    signature: tacticalSignature(t),
    manualOverride: false,
  };
}
describe("Advanced tactics V2", () => {
  it("learns roles from actual minutes, including substitutes and excluding unused players", () => {
    const c = initCareer("bra", "fla", "Minutos");
    c.tactics = activateAdvanced(c.tactics);
    const incoming = c.bench.find((id) => c.players[id]?.pos === "FW")!;
    const trained = learnTactics(c, "match", "minutes-fixture", [
      { playerId: c.lineup[1]!, role: "fullback", minutes: 90 },
      { playerId: incoming, role: "runner", minutes: 30 },
    ]);
    expect(trained.tactics.advanced!.familiarity.roles[incoming]).toBeCloseTo(50 + 1 / 3);
    expect(trained.tactics.advanced!.familiarity.roles[`role:runner:${incoming}`]).toBeCloseTo(
      50 + 1 / 3,
    );
    expect(trained.tactics.advanced!.familiarity.roles[c.lineup[2]!]).toBeUndefined();
    expect(validMatchTactics(trained.tactics)).toBe(true);
  });
  it("uses the second-last defender and the ball at release for advanced offside decisions", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "offside-v2");
    const receiver = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    const foes = sim.players.filter((p) => p.side === "away");
    foes.forEach((p) => (p.x = 8));
    foes[0]!.x = 48;
    foes[1]!.x = 25;
    const engine = sim as unknown as {
      advancedOffside(p: typeof receiver, x: number, dir: 1 | -1): boolean;
    };
    receiver.x = 20;
    expect(engine.advancedOffside(receiver, 0, 1)).toBe(false);
    receiver.x = 30;
    expect(engine.advancedOffside(receiver, 0, 1)).toBe(true);
    expect(engine.advancedOffside(receiver, 35, 1)).toBe(false);
    sim.phase = "done";
    sim.time = 99 * 60;
    expect(sim.clock()).toBe("90'");
  });
  it("keeps twelve valid eleven-player formations and phase positions in field", () => {
    expect(FORMATION_KEYS).toHaveLength(12);
    for (const formation of FORMATION_KEYS) {
      expect(FORMATIONS[formation]).toHaveLength(11);
      expect(FORMATIONS[formation].filter((s) => s.pos === "GK")).toHaveLength(1);
      const t = activateAdvanced({ ...legacy, formation });
      expect(TacticalProgramSchema.safeParse(t.advanced).success).toBe(true);
      for (const phase of ["possession", "defending", "won", "lost"] as const)
        for (let slot = 0; slot < 11; slot++) {
          const p = phasePosition(t, slot, phase)!;
          expect(Math.abs(p.x)).toBeLessThanOrEqual(0.96);
          expect(Math.abs(p.z)).toBeLessThanOrEqual(0.95);
        }
    }
  });
  it("opts in without mutating legacy saves, starting at neutral familiarity", () => {
    const t = activateAdvanced(legacy);
    expect(legacy).not.toHaveProperty("advanced");
    expect(t.advanced!.familiarity.team).toBe(50);
    expect(tacticalEffects(legacy)).toEqual({ attack: 1, exposure: 1, fatigue: 1, execution: 1 });
    expect(validMatchTactics(t)).toBe(true);
  });
  it("rejects invalid roles, duplicate slots, plans, unknown fields and unbounded records", () => {
    for (const change of [
      (p: ReturnType<typeof program>) => {
        p.advanced!.plans[0]!.players[0]!.role = "striker";
      },
      (p: ReturnType<typeof program>) => {
        p.advanced!.plans[0]!.players[1]!.slot = 0;
      },
      (p: ReturnType<typeof program>) => {
        p.advanced!.activePlanId = "missing";
      },
      (p: ReturnType<typeof program>) => {
        p.advanced!.familiarity.roles = Object.fromEntries(
          Array.from({ length: 201 }, (_, i) => [`p-${i}`, 50]),
        );
      },
    ]) {
      const t = program();
      change(t);
      expect(validMatchTactics(t)).toBe(false);
    }
    expect(TacticalProgramSchema.safeParse({ ...program().advanced, score: 999 }).success).toBe(
      false,
    );
  });
  it("uses priority, score, minute, fewer players and the five-minute cooldown", () => {
    const t = program(),
      state = runtime(t);
    expect(evaluateRules(t, state, { ...context, minute: 59 })).toBeUndefined();
    expect(evaluateRules(t, state, { ...context, players: 10 })?.planId).toBe("buscar");
    expect(
      evaluateRules(t, state, { ...context, minute: 61, goals: 2, players: 10 }),
    ).toBeUndefined();
    expect(evaluateRules(t, state, { ...context, minute: 65, goals: 2, players: 10 })?.planId).toBe(
      "cobrir",
    );
  });
  it("does not let a lower-priority rule displace the currently matching plan", () => {
    const t = program(),
      state = runtime(t);
    expect(evaluateRules(t, state, { ...context, players: 10 })?.planId).toBe("buscar");
    expect(evaluateRules(t, state, { ...context, minute: 70, players: 10 })).toBeUndefined();
  });
  it("breaks equal priorities with ordinal IDs rather than the host language", () => {
    const t = program();
    const rule = t.advanced!.rules[0]!;
    t.advanced!.rules = [
      { ...rule, id: "á", planId: "buscar" },
      { ...rule, id: "Z", planId: "cobrir" },
    ];
    expect(evaluateRules(t, runtime(t), context)?.planId).toBe("cobrir");
    expect(evaluateRules(t, runtime(t), context)?.ruleId).toBe("Z");
  });
  it("suspends automation for manual changes and permits explicit resume", () => {
    const t = manualTactics(program(), { pressing: 0, mentality: 4 });
    expect(t.advanced!.automation).toBe(false);
    expect(activePlan(t)!.mentality).toBe(4);
    expect(activePlan(t)!.defending.pressing).toBe(0);
    expect(evaluateRules(t, runtime(t), context)).toBeUndefined();
    t.advanced!.automation = true;
    expect(evaluateRules(t, runtime(t), context)?.planId).toBe("buscar");
  });
  it("learns once per round or match, preserving identity and career records", () => {
    const c = initCareer("bra", "fla", "Tático");
    c.tactics = activateAdvanced(c.tactics);
    const trained = learnTactics(c, "training", "1:1");
    expect(trained.tactics.advanced!.familiarity.team).toBe(53);
    expect(learnTactics(trained, "training", "1:1")).toBe(trained);
    const played = learnTactics(trained, "match", "1:1:fla:pal");
    expect(played.tactics.advanced!.familiarity.team).toBe(54);
    expect(learnTactics(played, "match", "1:1:fla:pal")).toBe(played);
    expect(played.fixtures).toBe(c.fixtures);
    expect(played.players).toBe(c.players);
  });
  it("changes spatial motion, preserves deterministic checkpoints and survives substitutions and dismissals", () => {
    const home = buildTeamSetup("fla", "4-3-3", 2, 1, { cpu: false });
    home.tactics = program();
    const away = buildTeamSetup("pal");
    away.tactics = opponentProgram(away.tactics, away.players);
    const a = new MatchSim(structuredClone(home), structuredClone(away), "advanced-recovery");
    const b = new MatchSim(structuredClone(home), structuredClone(away), "advanced-recovery");
    for (let i = 0; i < 500; i++) a.step(0.1);
    b.restoreCheckpoint(a.checkpoint());
    for (const sim of [a, b]) {
      const out = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
      expect(sim.substitute("home", out.pid, home.bench![0]!)).toBe(true);
      sim.players.find((p) => p.side === "home" && p.pos === "DF")!.sentOff = true;
      for (let i = 0; i < 500; i++) sim.step(0.1);
    }
    expect(b.stats).toEqual(a.stats);
    expect(b.ball).toEqual(a.ball);
    expect(b.players).toEqual(a.players);
    expect(b.analytics).toEqual(a.analytics);
    expect(a.analytics.samples).toBeLessThanOrEqual(Math.ceil(a.time));
  });
  it("exposes measured analytics only while subscribed and at the final result", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "analytics");
    for (let i = 0; i < 100; i++) sim.step(0.1);
    expect(snapshotMatch(sim, 1).analytics).toBeUndefined();
    expect(snapshotMatch(sim, 2, undefined, true, true).analytics?.source).toBe("spatial");
    expect(snapshotMatch(sim, 3, undefined, true, true).analytics).toBeUndefined();
    sim.finished = true;
    expect(resultMatch(sim, 4).analytics?.source).toBe("spatial");
    expect(validMatchCommand({ id: 1, type: "analyticsLive", visible: true })).toBe(true);
    expect(validMatchCommand({ id: 1, type: "analyticsLive", visible: 1 })).toBe(false);
  });
  it("applies advanced plans in compact progression without fabricating spatial data", () => {
    const t = program();
    const a = advancedQuickScore(80, 80, "quick", { homeTactics: t });
    expect(a).toEqual(advancedQuickScore(80, 80, "quick", { homeTactics: t }));
    expect(a.analytics.source).toBe("quick");
    expect(a.analytics.timeline).toHaveLength(90);
    expect(a.analytics.connections).toEqual([]);
    expect(a.analytics.occupancy.home.every((v) => v === 0)).toBe(true);
    const slower = withPlan(t, presetPlan(t, "Bloco baixo", t.advanced!.activePlanId));
    expect(
      advancedQuickScore(80, 80, "quick", { homeTactics: slower }).analytics.timeline.at(-1)
        ?.homeXg,
    ).not.toBe(a.analytics.timeline.at(-1)?.homeXg);
  });
  it("stores only available summaries, bounded to the most recent hundred matches", () => {
    let c = initCareer("bra", "fla", "Análise");
    expect(c.matchAnalytics).toBeUndefined();
    for (let i = 0; i < 110; i++)
      c = appendMatchAnalytics(c, {
        id: `m${i}`,
        season: 1,
        round: i + 1,
        home: "fla",
        away: "pal",
        source: "spatial",
        score: [1, 0],
        xg: [1, 0.5],
        possession: [50, 50],
        passes: [12, 10],
        changes: [],
      });
    expect(c.matchAnalytics).toHaveLength(100);
    expect(repairMatchAnalytics([...c.matchAnalytics!, { score: [Infinity, 0] }])).toHaveLength(
      100,
    );
    c.tactics = activateAdvanced(c.tactics);
    const week = autoWeek(c, 1_800_000_000_000)!;
    expect(week.state.matchAnalytics?.[0]?.source).toBe("quick");
    expect(week.state.tactics.advanced!.familiarity.team).toBe(51);
  });
  it("keeps final chart totals equal to statistics without mutating the engine", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "final-totals");
    sim.time = 5402;
    sim.stats.home.xg = 2.4;
    sim.stats.home.passesOk = 180;
    const original = structuredClone(sim.analytics);
    const copy = analyticsSnapshot(sim.analytics, sim.time, sim.stats, sim.shotMap);
    expect(copy.timeline.at(-1)).toMatchObject({ minute: 90, homeXg: 2.4, homePasses: 180 });
    expect(sim.analytics).toEqual(original);
  });
  it("keeps period maps and passing counts measured and bounded", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "periods");
    const a = createMatchAnalytics();
    const from = sim.players[1]!,
      to = sim.players[2]!;
    sampleAnalytics(a, 899, sim.players, sim.stats);
    recordPass(a, from, to);
    sampleAnalytics(a, 901, sim.players, sim.stats);
    recordPass(a, from, to, true);
    expect(a.periods).toHaveLength(2);
    expect(a.periods![0]!.passes[0]).toEqual([0, 1, 1]);
    expect(a.periods![1]!.occupancy.home.reduce((s, n) => s + n, 0)).toBe(11);
    expect(a.connections[0]).toMatchObject({ fromName: from.name, toName: to.name, completed: 1 });
  });
  it("uses designated set-piece takers, short corners and fallback after dismissal", () => {
    const home = buildTeamSetup("fla"),
      away = buildTeamSetup("pal");
    home.tactics = activateAdvanced(home.tactics);
    const sim = new MatchSim(home, away, "set-pieces");
    const designated = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
    const backup = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    activePlan(home.tactics)!.setPieces.corners = [designated.pid, backup.pid];
    activePlan(home.tactics)!.setPieces.penalties = [designated.pid, backup.pid];
    activePlan(home.tactics)!.setPieces.target = "short";
    const engine = sim as unknown as {
      setupCorner(side: "home"): void;
      takeCorner(): void;
      bestTaker(side: "home", attr: "shooting", kind: "penalties"): typeof designated;
    };
    expect(engine.bestTaker("home", "shooting", "penalties").pid).toBe(designated.pid);
    designated.sentOff = true;
    expect(engine.bestTaker("home", "shooting", "penalties").pid).toBe(backup.pid);
    engine.setupCorner("home");
    engine.takeCorner();
    expect(sim.stats.home.corners).toBe(1);
    expect(sim.stats.home.passesOk).toBe(1);
    expect(sim.analytics.connections.at(-1)?.from).toBe(backup.pid);
  });
  it("reevaluates goals and dismissals within the same simulated minute", () => {
    const home = buildTeamSetup("fla"),
      away = buildTeamSetup("pal");
    home.tactics = program();
    const sim = new MatchSim(home, away, "rule-events");
    sim.phase = "second";
    sim.time = 61 * 60;
    sim.step(0.1);
    sim.stats.away.goals = 1;
    sim.step(0.1);
    expect(activePlan(sim.home.tactics)?.id).toBe("buscar");
    sim.time = 67 * 60;
    sim.stats.home.goals = 2;
    sim.stats.home.red = 1;
    sim.players.find((p) => p.side === "home" && p.pos === "DF")!.sentOff = true;
    sim.step(0.1);
    expect(activePlan(sim.home.tactics)?.id).toBe("cobrir");
  });
  it("supports numerical-disadvantage rules in deterministic compact matches", () => {
    const t = program();
    t.advanced!.rules = [
      {
        id: "cover-red",
        planId: "cobrir",
        priority: 90,
        enabled: true,
        minute: 0,
        score: "any",
        fewerPlayers: true,
        conditionBelow: 0,
      },
    ];
    let matched = false;
    for (let i = 0; i < 100 && !matched; i++) {
      const result = advancedQuickScore(80, 80, `red-fixture-${i}`, { homeTactics: t });
      const red = result.events.find((e) => e.kind === "vermelho" && e.side === "home");
      if (red) {
        expect(result.analytics.changes).toContainEqual(
          expect.objectContaining({ minute: red.minute, planId: "cobrir" }),
        );
        matched = true;
      }
    }
    expect(matched).toBe(true);
  });
});
