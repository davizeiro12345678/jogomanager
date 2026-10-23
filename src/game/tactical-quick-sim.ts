import { makeRng } from "./rng";
import { expectedGoals, type MatchConditions } from "./match-probability";
import {
  activePlan,
  evaluateRules,
  tacticalEffects,
  tacticalSignature,
  withPlan,
  type TacticalRuntimeState,
} from "./tactical-plan";
import { createMatchAnalytics } from "./match-analytics";
import type { FixtureEvent, Tactics } from "./types";

/** Opt-in compact timeline. Legacy Poisson path is untouched. */
export function advancedQuickScore(home: number, away: number, seed: string, ctx: MatchConditions) {
  const rnd = makeRng(`tactical-quick-v2:${seed}`);
  const normalize = (t: MatchConditions["homeTactics"]): Tactics => ({
    formation: t?.formation ?? "4-3-3",
    mentality: t?.mentality ?? 2,
    pressing: t?.pressing ?? 1,
    width: t?.width ?? 1,
    tempo: t?.tempo ?? 1,
    ...(t?.advanced ? { advanced: structuredClone(t.advanced) } : {}),
  });
  let ht = normalize(ctx.homeTactics),
    at = normalize(ctx.awayTactics);
  const runtime = (t: Tactics): TacticalRuntimeState => ({
    activePlanId: t.advanced?.activePlanId ?? "",
    signature: tacticalSignature(t),
    lastAutomaticAt: -5,
    lastEvaluationMinute: -1,
    manualOverride: false,
  });
  const hRuntime = runtime(ht),
    aRuntime = runtime(at),
    analytics = createMatchAnalytics("quick");
  const events: FixtureEvent[] = [];
  let hg = 0,
    ag = 0,
    hxg = 0,
    axg = 0,
    hCondition = 100 - (ctx.homeFatigue ?? 0),
    aCondition = 100 - (ctx.awayFatigue ?? 0);
  let hPlayers = 11,
    aPlayers = 11;
  // A separate event stream keeps discipline deterministic and makes numerical
  // disadvantage available to the same rule evaluator as spatial matches.
  const discipline = makeRng(`tactical-discipline-v2:${seed}`);
  const redMinute = discipline() < 0.12 ? 30 + Math.floor(discipline() * 60) : -1;
  const redSide = discipline() < 0.55 ? "away" : "home";
  function rules(minute: number, force = false) {
    for (const side of ["home", "away"] as const) {
      const t = side === "home" ? ht : at;
      const state = side === "home" ? hRuntime : aRuntime;
      const change = evaluateRules(
        t,
        state,
        {
          minute,
          goals: side === "home" ? hg : ag,
          opponents: side === "home" ? ag : hg,
          players: side === "home" ? hPlayers : aPlayers,
          opponentPlayers: side === "home" ? aPlayers : hPlayers,
          condition: side === "home" ? hCondition : aCondition,
        },
        force,
      );
      if (change) {
        const next = withPlan(
          t,
          t.advanced!.plans.find((p) => p.id === change.planId)!,
        );
        if (side === "home") ht = next;
        else at = next;
        analytics.changes.push({ ...change, side });
        analytics.changes = analytics.changes.slice(-40);
      }
    }
  }
  for (let minute = 1; minute <= 90; minute++) {
    const dismissed = minute === redMinute;
    if (dismissed) {
      if (redSide === "home") hPlayers--;
      else aPlayers--;
      events.push({ minute, side: redSide, kind: "vermelho" });
    }
    rules(minute, dismissed);
    const h = tacticalEffects(ht),
      a = tacticalEffects(at);
    const rates = expectedGoals(home, away, seed, { ...ctx, homeTactics: ht, awayTactics: at });
    const setPieces = (t: Tactics) => {
      const p = activePlan(t);
      if (!p) return 1;
      // Compact expectations reflect attacking numbers and protection; they
      // are not reported as measured corners or player-specific events.
      return (
        1 + (2 - p.setPieces.stayBack) * 0.008 + (p.setPieces.target === "short" ? -0.004 : 0.002)
      );
    };
    const hr =
      (rates.home *
        h.attack *
        a.exposure *
        setPieces(ht) *
        (0.8 + hCondition / 500) *
        Math.pow(hPlayers / 11, 1.6) *
        Math.pow(11 / aPlayers, 0.6)) /
      90;
    const ar =
      (rates.away *
        a.attack *
        h.exposure *
        setPieces(at) *
        (0.8 + aCondition / 500) *
        Math.pow(aPlayers / 11, 1.6) *
        Math.pow(11 / hPlayers, 0.6)) /
      90;
    hxg += hr;
    axg += ar;
    let goal = false;
    if (rnd() < hr) {
      goal = true;
      hg++;
      events.push({ minute, side: "home", kind: "gol" });
    }
    if (rnd() < ar) {
      goal = true;
      ag++;
      events.push({ minute, side: "away", kind: "gol" });
    }
    if (goal) rules(minute, true);
    hCondition = Math.max(12, hCondition - 0.18 * h.fatigue);
    aCondition = Math.max(12, aCondition - 0.18 * a.fatigue);
    // These are expectations, never spatial pass/possession observations.
    analytics.timeline.push({
      minute,
      homeXg: hxg,
      awayXg: axg,
      homePossession: 0,
      awayPossession: 0,
      homePasses: 0,
      awayPasses: 0,
      homeRecoveries: 0,
      awayRecoveries: 0,
    });
  }
  return { hg, ag, events, analytics };
}
