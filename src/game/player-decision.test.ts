import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, type SimPlayer } from "./sim";

function scenario() {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "pass-decision-test");
  const home = sim.players.filter((p) => p.side === "home");
  const away = sim.players.filter((p) => p.side === "away");
  for (const player of home) {
    player.x = -48;
    player.z = -30;
    player.vx = 0;
    player.vz = 0;
  }
  for (const player of away) {
    player.x = -40;
    player.z = 30;
    player.vx = 0;
    player.vz = 0;
  }
  const holder = home.find((p) => p.pos === "MF")!;
  const safe = home.find((p) => p.pos === "FW")!;
  const offside = home.find((p) => p.pos === "FW" && p !== safe)!;
  const goalkeeper = away.find((p) => p.pos === "GK")!;
  const defender = away.find((p) => p.pos === "DF")!;
  Object.assign(holder, { x: 5, z: 0 });
  Object.assign(safe, { x: 20, z: 8 });
  Object.assign(offside, { x: 38, z: 0 });
  Object.assign(goalkeeper, { x: 50, z: 0 });
  Object.assign(defender, { x: 30, z: 15 });
  sim.ball.holder = holder.id;
  sim.possession = "home";
  sim.time = 60;
  const internal = sim as unknown as {
    decide: (player: SimPlayer) => void;
    controlBall: (player: SimPlayer, speed: number, height: number) => void;
    exemptUntil: number;
  };
  return { sim, holder, safe, offside, defender, internal };
}

function passTarget(sim: MatchSim) {
  return (sim.checkpoint().state["pass"] as { to: string } | null)?.to;
}

describe("local passing decisions", () => {
  it("chooses an available onside teammate instead of an attractive offside target", () => {
    const { sim, holder, safe, internal } = scenario();
    internal.decide(holder);
    expect(passTarget(sim)).toBe(safe.id);
  });

  it("avoids a clearly offside pass when the away team attacks in the opposite direction", () => {
    const { sim, holder, safe, internal } = scenario();
    for (const player of sim.players) {
      player.side = player.side === "home" ? "away" : "home";
      player.x = -player.x;
    }
    sim.possession = "away";
    internal.decide(holder);
    expect(passTarget(sim)).toBe(safe.id);
  });

  it("keeps possession when the only available recipient is offside", () => {
    const { sim, holder, safe, internal } = scenario();
    safe.x = -48;
    internal.decide(holder);
    expect(sim.ball.holder).toBe(holder.id);
    expect(passTarget(sim)).toBeUndefined();
  });

  it("does not call offside when an onside receiver runs beyond the line after the pass", () => {
    const { sim, holder, safe, offside, internal } = scenario();
    offside.x = -48;
    internal.decide(holder);
    expect(passTarget(sim)).toBe(safe.id);
    safe.x = 40;
    internal.controlBall(safe, 0, 0);
    expect(sim.stats.home.offsides).toBe(0);
  });

  it("preserves an exemption that was active when the pass was made", () => {
    const { sim, holder, safe, offside, internal } = scenario();
    safe.x = -48;
    internal.exemptUntil = 61;
    internal.decide(holder);
    expect(passTarget(sim)).toBe(offside.id);
    sim.time = 62;
    internal.controlBall(offside, 0, 0);
    expect(sim.stats.home.offsides).toBe(0);
  });

  it("calls a marginal offside from the pass even if the receiver returns onside", () => {
    const { sim, holder, safe, offside, internal } = scenario();
    safe.x = -48;
    offside.x = 30.8;
    for (const defender of sim.players) {
      if (defender.side === "away" && defender.pos !== "GK") defender.x = 30;
    }
    internal.decide(holder);
    expect(passTarget(sim)).toBe(offside.id);
    offside.x = 25;
    internal.controlBall(offside, 0, 0);
    expect(sim.stats.home.offsides).toBe(1);
  });
});
