import { CLUBS } from "../data/leagues";
import { buildTeamSetup } from "../quickMatch";
import { MatchSim } from "../sim";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
} from "../sim-contracts";
import type {
  MatchPublicStateV1,
  MatchSeat,
  PresentationEventV1,
  TacticalCommandPayloadV1,
} from "./match-protocol";
import type { AuthoritativeMatchEngine } from "./authoritative-match-session";

const TACTICAL_LEVELS = {
  mentality: ["defensive", "cautious", "balanced", "positive", "attacking"],
  pressing: ["low", "medium", "high"],
  width: ["narrow", "balanced", "wide"],
  tempo: ["slow", "balanced", "fast"],
} as const;

const EVENT_TYPES: Record<string, PresentationEventV1["type"] | undefined> = {
  kickoff: "kickoff",
  shot: "chance",
  chance: "chance",
  save: "chance",
  goal: "goal",
  yellow: "card",
  red: "card",
  sub: "substitution",
  halftime: "half_time",
  fulltime: "full_time",
};

/**
 * The canonical fixed-step simulation, running in a server-only execution
 * context with a private seed. No browser state, scores, or random values
 * enter this adapter. It does not create a network transport on its own.
 */
export class CanonicalAuthoritativeMatchEngine implements AuthoritativeMatchEngine {
  readonly sim: MatchSim;
  private tick = 0;
  private lastPresentationEventId = -1;
  private readonly publicEvents: PresentationEventV1[] = [];

  constructor(homeClub: string, awayClub: string, privateSeed: string) {
    if (!Object.hasOwn(CLUBS, homeClub) || !Object.hasOwn(CLUBS, awayClub)) {
      throw new Error("unrecognized authoritative match club");
    }
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(privateSeed)) {
      throw new Error("invalid authoritative match seed");
    }
    const human = { cpu: false, tacticalAiRevision: 2 as const };
    this.sim = new MatchSim(
      buildTeamSetup(homeClub, "4-3-3", 2, 1, human),
      buildTeamSetup(awayClub, "4-3-3", 2, 1, human),
      privateSeed,
    );
  }

  advanceFixedStep(): boolean {
    if (this.sim.finished) return false;
    if (this.tick >= MATCH_SIMULATION_TICK_LIMIT) {
      throw new Error("authoritative match tick budget exhausted");
    }
    this.capturePresentationEvents();
    this.sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    this.tick += 1;
    this.capturePresentationEvents();
    return true;
  }

  publicState(): MatchPublicStateV1 {
    const [homePossession] = this.sim.possessionPct();
    return {
      minute: Math.min(130, Math.max(0, Math.trunc(this.sim.minute()))),
      score: { home: this.sim.stats.home.goals, away: this.sim.stats.away.goals },
      possession: { home: homePossession, away: 100 - homePossession },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    this.capturePresentationEvents();
    return this.publicEvents.map((event) => ({ ...event }));
  }

  private capturePresentationEvents(): void {
    if (this.sim.lastEventId <= this.lastPresentationEventId) return;
    const firstEventId = this.sim.lastEventId - this.sim.events.length + 1;
    for (
      let index = Math.max(0, this.lastPresentationEventId + 1 - firstEventId);
      index < this.sim.events.length;
      index += 1
    ) {
      const event = this.sim.events[index]!;
      const type = EVENT_TYPES[event.type];
      if (!type) continue;
      this.publicEvents.push({
        id: `event-${firstEventId + index}`,
        type,
        tick: this.tick,
        ...(event.side !== "neutral" ? { team: event.side } : {}),
      });
    }
    this.lastPresentationEventId = this.sim.lastEventId;
    if (this.publicEvents.length > 64) this.publicEvents.splice(0, this.publicEvents.length - 64);
  }

  applyTactics(seat: MatchSeat, payload: TacticalCommandPayloadV1): boolean {
    if (this.sim.finished) return false;
    const setup = this.sim.setup(seat);
    // Formation changes and extended role instructions require a separately
    // versioned lineup/replay contract. Reject, never silently ignore, them.
    if (
      payload.formation !== setup.tactics.formation ||
      payload.lineHeight !== "standard" ||
      (payload.roles?.length ?? 0) > 0 ||
      (payload.inPossession?.length ?? 0) > 0 ||
      (payload.outOfPossession?.length ?? 0) > 0
    )
      return false;
    const mentality = TACTICAL_LEVELS.mentality.indexOf(payload.mentality);
    const pressing = TACTICAL_LEVELS.pressing.indexOf(payload.pressing);
    const width = TACTICAL_LEVELS.width.indexOf(payload.width);
    const tempo = TACTICAL_LEVELS.tempo.indexOf(payload.tempo);
    if ([mentality, pressing, width, tempo].some((value) => value < 0)) return false;
    setup.tactics = { ...setup.tactics, mentality, pressing, width, tempo };
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string): boolean {
    if (this.sim.finished) return false;
    const active = this.sim.players.find(
      (player) => player.side === seat && (player.id === playerOut || player.pid === playerOut),
    );
    const incoming = this.sim
      .setup(seat)
      .bench?.find((player) => player.id === playerIn || `${seat}-${player.id}` === playerIn);
    if (!active || !incoming) return false;
    const substituted = this.sim.substitute(seat, active.pid, incoming);
    this.capturePresentationEvents();
    return substituted;
  }

  finalResult(loser?: MatchSeat) {
    if (loser === "home") return { homeGoals: 0, awayGoals: 3, winner: "away" as const };
    if (loser === "away") return { homeGoals: 3, awayGoals: 0, winner: "home" as const };
    const homeGoals = this.sim.stats.home.goals;
    const awayGoals = this.sim.stats.away.goals;
    return {
      homeGoals,
      awayGoals,
      winner:
        homeGoals === awayGoals
          ? ("draw" as const)
          : homeGoals > awayGoals
            ? ("home" as const)
            : ("away" as const),
    };
  }

  dispose(): void {
    this.sim.dispose();
  }
}
