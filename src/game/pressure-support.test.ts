import { describe, expect, it, vi } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { pressure } from "./sim-ball-duels";
import { FIELD_X, FIELD_Z } from "./sim-rules";

type SupportState = "sentOff" | "active" | "distant";

function contestPossession(
  supportState: SupportState,
  defendingRevision?: 2,
  attackingRevision?: 2,
) {
  const sim = new MatchSim(
    buildTeamSetup("fla", "4-3-3", 2, 1, {
      morale: 70,
      ...(attackingRevision === 2 ? { tacticalAiRevision: 2 as const } : {}),
    }),
    buildTeamSetup("pal", "4-3-3", 2, 1, {
      morale: 70,
      ...(defendingRevision === 2 ? { tacticalAiRevision: 2 as const } : {}),
    }),
    "pressure-expelled-support",
    { contactPhysicsRevision: 2 },
  );
  try {
    const holder = sim.players.find((player) => player.side === "home" && player.pos !== "GK")!;
    const defenders = sim.players.filter((player) => player.side === "away" && player.pos !== "GK");
    const challenger = defenders[0]!;
    const support = defenders[1]!;
    for (const player of sim.players) {
      player.x = 30;
      player.z = player.side === "home" ? -20 : 20;
      player.pace = 50;
      player.passing = 50;
      player.defending = 50;
      player.physical = 50;
      player.stamina = 100;
    }
    // sendOff moves the expelled athlete beyond the corner. A live duel by
    // that touchline can still fall inside the old 3.2m support radius.
    holder.x = FIELD_X - 1;
    holder.z = FIELD_Z - 0.5;
    challenger.x = holder.x - 0.8;
    challenger.z = holder.z;
    if (supportState !== "distant") {
      support.x = holder.x - 1.8;
      support.z = holder.z - 1;
      if (supportState === "sentOff") sim.sendOff(support, "test fixture");
    }
    sim.ball.holder = holder.id;
    sim.ball.x = holder.x - 0.9;
    sim.ball.z = holder.z;
    sim.ball.height = 0.12;
    sim.possession = "home";
    sim.restartTimer = 0;
    // This draw loses an isolated tackle but wins with one supporting athlete.
    // Later draws avoid a foul, slide and injury so possession is the observable.
    const random = vi.spyOn(sim, "rnd").mockReturnValueOnce(0.062).mockReturnValue(0.9);

    pressure(sim, holder, 0.1);

    return {
      winner: sim.ball.holder === holder.id ? "holder" : "challenger",
      possession: sim.possession,
      tackles: challenger.tackles,
      randomDraws: random.mock.calls.length,
    };
  } finally {
    sim.dispose();
  }
}

describe("versioned defensive support in a possession duel", () => {
  it("does not let an expelled defender improve a v2 teammate's tackle", () => {
    const unsupported = contestPossession("distant", 2);
    expect(unsupported).toEqual({
      winner: "holder",
      possession: "home",
      tackles: 0,
      randomDraws: 1,
    });
    expect(contestPossession("sentOff", 2)).toEqual(unsupported);
  });

  it("retains the support bonus from an active nearby v2 defender", () => {
    expect(contestPossession("active", 2)).toEqual({
      winner: "challenger",
      possession: "away",
      tackles: 1,
      randomDraws: 4,
    });
  });

  it("preserves the historical result and random draw order when the revision is omitted", () => {
    expect(contestPossession("sentOff")).toEqual(contestPossession("active"));
    expect(contestPossession("sentOff")).toEqual({
      winner: "challenger",
      possession: "away",
      tackles: 1,
      randomDraws: 4,
    });
    expect(contestPossession("distant").winner).toBe("holder");
  });

  it("uses the defending team's revision rather than the ball carrier's revision", () => {
    expect(contestPossession("sentOff", undefined, 2).winner).toBe("challenger");
    expect(contestPossession("sentOff", 2).winner).toBe("holder");
  });
});
