import { CLUBS } from "../data/leagues";
import { snapshotMatch, type LiveSnapshot } from "../live-match";
import { buildTeamSetup } from "../quickMatch";
import { LIVE_MATCH_CLOCK_SCALE, MATCH_SIMULATION_STEP, MatchSim } from "../sim";
import type { MatchEventLog } from "../types";
import type { AuthoritativeMatchEngine } from "./authoritative-match-session";
import {
  TacticalCommandPayloadV1Schema,
  type MatchPublicStateV1,
  type MatchReceiptV1,
  type MatchSeat,
  type PresentationEventV1,
  type TacticalCommandPayloadV1,
} from "./match-protocol";

/** Canonical engine adapter. A transport and persistent match owner are still required. */
export class MatchSimAuthority implements AuthoritativeMatchEngine {
  readonly #sim: MatchSim;
  #tick = 0;
  #eventId = 0;
  #events: PresentationEventV1[] = [{ id: "event-0", type: "kickoff", tick: 0 }];

  constructor(homeClub: string, awayClub: string, serverSeed: string, awayIsAi: boolean) {
    if (!Object.hasOwn(CLUBS, homeClub) || !Object.hasOwn(CLUBS, awayClub))
      throw new Error("unknown_club");
    if (serverSeed.length < 16 || serverSeed.length > 128) throw new Error("invalid_seed");
    this.#sim = new MatchSim(
      buildTeamSetup(homeClub, "4-3-3", 2, 1, { cpu: false }),
      buildTeamSetup(awayClub, "4-3-3", 2, 1, { cpu: awayIsAi }),
      serverSeed,
    );
  }

  advanceFixedStep(): void {
    if (this.#sim.finished) return;
    this.#sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    this.#tick += 1;
    const difference = this.#sim.lastEventId - this.#eventId;
    if (difference > 0) {
      const recent = this.#sim.events.slice(-difference);
      const firstId = this.#sim.lastEventId - recent.length + 1;
      recent.forEach((event, index) => {
        const type = this.eventType(event.type);
        if (!type) return;
        this.#events.push({
          id: `event-${firstId + index}`,
          type,
          tick: this.#tick,
          ...(event.side === "neutral" ? {} : { team: event.side }),
        });
      });
      this.#eventId = this.#sim.lastEventId;
      this.#events = this.#events.slice(-64);
    }
  }

  publicState(): MatchPublicStateV1 {
    const ticks = this.#sim.stats.home.possessionTicks + this.#sim.stats.away.possessionTicks;
    const home = ticks ? this.#sim.possessionPct()[0] : 50;
    return {
      minute: Math.min(130, this.#sim.minute()),
      score: { home: this.#sim.stats.home.goals, away: this.#sim.stats.away.goals },
      possession: { home, away: 100 - home },
    };
  }

  presentationEvents(): PresentationEventV1[] {
    return this.#events.map((event) => ({ ...event }));
  }

  visualSnapshot(): LiveSnapshot {
    return snapshotMatch(this.#sim, this.#tick);
  }

  isFinished(): boolean {
    return this.#sim.finished;
  }

  applyTactics(seat: MatchSeat, payload: TacticalCommandPayloadV1): boolean {
    const parsed = TacticalCommandPayloadV1Schema.safeParse(payload);
    if (!parsed.success || this.#sim.finished) return false;
    const data = parsed.data;
    const team = seat === "home" ? this.#sim.home : this.#sim.away;
    // The current engine cannot reposition a formation after kickoff or apply
    // the remaining advanced instructions; reject rather than silently ignore.
    if (
      data.formation !== team.tactics.formation ||
      data.lineHeight !== "standard" ||
      data.roles?.length ||
      data.inPossession?.length ||
      data.outOfPossession?.length
    )
      return false;
    team.tactics = {
      formation: team.tactics.formation,
      mentality: ["defensive", "cautious", "balanced", "positive", "attacking"].indexOf(
        data.mentality,
      ),
      pressing: ["low", "medium", "high"].indexOf(data.pressing),
      width: ["narrow", "balanced", "wide"].indexOf(data.width),
      tempo: ["slow", "balanced", "fast"].indexOf(data.tempo),
    };
    return true;
  }

  substitute(seat: MatchSeat, playerOut: string, playerIn: string): boolean {
    const team = seat === "home" ? this.#sim.home : this.#sim.away;
    const registered = team.bench?.find((player) => player.id === playerIn);
    return registered ? this.#sim.substitute(seat, playerOut, registered) : false;
  }

  finalResult(loser?: MatchSeat): MatchReceiptV1["result"] {
    if (loser)
      return loser === "home"
        ? { homeGoals: 0, awayGoals: 3, winner: "away" }
        : { homeGoals: 3, awayGoals: 0, winner: "home" };
    if (!this.#sim.finished) throw new Error("unfinished_match");
    const homeGoals = this.#sim.stats.home.goals;
    const awayGoals = this.#sim.stats.away.goals;
    return {
      homeGoals,
      awayGoals,
      winner: homeGoals === awayGoals ? "draw" : homeGoals > awayGoals ? "home" : "away",
    };
  }

  private eventType(type: MatchEventLog["type"]): PresentationEventV1["type"] | null {
    switch (type) {
      case "goal":
        return "goal";
      case "chance":
      case "shot":
        return "chance";
      case "yellow":
      case "red":
        return "card";
      case "sub":
        return "substitution";
      case "kickoff":
        return "kickoff";
      case "halftime":
        return "half_time";
      case "fulltime":
        return "full_time";
      default:
        return null;
    }
  }
}
