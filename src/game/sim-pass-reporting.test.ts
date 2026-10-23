import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { activateAdvanced, activePlan } from "./tactical-plan";
import type { SimPlayer } from "./sim-types";
import { recordPass } from "./match-analytics";

describe("team pass completion conventions", () => {
  it.each([true, false])("does not retouch its own unresolved pass, pending=%s", (pending) => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "pending-pass-release");
    const passer = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
    const intended = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    for (const player of sim.players) {
      player.x = 40;
      player.z = 20;
    }
    passer.x = passer.z = 0;
    sim.time = 10;
    sim.ball.holder = null;
    sim.ball.x = 0.3;
    sim.ball.z = 0;
    sim.ball.vx = 10;
    sim.ball.vz = 0;
    sim.ball.height = 0.12;
    const internal = sim as unknown as {
      pass: unknown;
      moveBall(dt: number, physics: boolean): void;
      controlBall(p: SimPlayer, speed: number, h: number): void;
    };
    internal.pass = pending
      ? {
          from: passer.id,
          to: intended.id,
          side: "home",
          fromX: 0,
          dir: 1,
          until: 0,
          offsideAtKick: false,
        }
      : null;
    const touched: string[] = [];
    const original = internal.controlBall.bind(sim);
    internal.controlBall = (p, speed, h) => {
      touched.push(p.id);
      return original(p, speed, h);
    };
    internal.moveBall(1 / 30, false);
    expect(touched.includes(passer.id)).toBe(!pending);
    sim.dispose();
  });
  it("counts a controlled pass to a different teammate without treating an opponent as a completion", () => {
    for (const targetSide of ["home", "away"] as const) {
      const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "pass-completion");
      const passer = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
      const intended = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
      const receiver = sim.players.find(
        (p) => p.side === targetSide && p !== passer && p !== intended,
      )!;
      receiver.passing = receiver.physical = receiver.defending = 100;
      const internal = sim as unknown as {
        rnd: () => number;
        pass: unknown;
        controlBall(p: SimPlayer, speed: number, height: number): void;
      };
      internal.rnd = () => 0;
      passer.passes++;
      sim.stats.home.passes++;
      recordPass(sim.analytics, passer, intended);
      internal.pass = {
        from: passer.id,
        to: intended.id,
        side: "home",
        fromX: 0,
        dir: 1,
        until: 1,
        offsideAtKick: false,
      };
      internal.controlBall(receiver, 0, 0.12);
      expect(sim.stats.home.passesOk).toBe(targetSide === "home" ? 1 : 0);
      expect(sim.stats.away.passesOk).toBe(0);
      expect(sim.analytics.connections.reduce((n, edge) => n + edge.attempts, 0)).toBe(
        sim.stats.home.passes,
      );
      expect(sim.analytics.connections.every((edge) => edge.completed <= edge.attempts)).toBe(true);
      expect(
        sim.analytics.periods!.every((period) =>
          period.passes.every((counts) => counts[2] <= counts[1]),
        ),
      ).toBe(true);
      sim.dispose();
    }
  });

  it("keeps a substituted passer's one attempt and completed reception", () => {
    const sim = new MatchSim(
      buildTeamSetup("fla"),
      buildTeamSetup("pal"),
      "passer-subbed-in-flight",
    );
    const passer = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
    const receiver = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    const internal = sim as unknown as {
      rnd: () => number;
      pass: unknown;
      controlBall(p: SimPlayer, speed: number, height: number): void;
    };
    passer.passes++;
    sim.stats.home.passes++;
    recordPass(sim.analytics, passer, receiver);
    internal.pass = {
      from: passer.id,
      to: receiver.id,
      side: "home",
      fromX: 0,
      dir: 1,
      until: 1,
      offsideAtKick: false,
    };
    const incoming = sim.home.bench!.find((p) => p.pos === "MF")!;
    expect(sim.substitute("home", passer.pid, incoming)).toBe(true);
    internal.rnd = () => 0;
    internal.controlBall(receiver, 0, 0.12);
    expect(sim.stats.home.passesOk).toBe(1);
    expect(sim.analytics.connections[0]!.completed).toBe(1);
    expect(sim.analytics.connections[0]!.attempts).toBe(1);
    sim.dispose();
  });

  it("counts the short-corner attempt for its actual taker", () => {
    const sim = new MatchSim(
      buildTeamSetup("fla"),
      buildTeamSetup("pal"),
      "short-corner-pass-report",
    );
    sim.home.tactics = activateAdvanced(sim.home.tactics);
    activePlan(sim.home.tactics)!.setPieces.target = "short";
    const internal = sim as unknown as {
      setupCorner(side: "home"): void;
      takeCorner(): void;
      setPiece: { takerId: string };
    };
    internal.setupCorner("home");
    const taker = sim.players.find((p) => p.id === internal.setPiece.takerId)!;
    const before = taker.passes;
    internal.takeCorner();
    expect(taker.passes - before).toBe(1);
    expect(sim.stats.home.passes).toBe(1);
    expect(sim.stats.home.passesOk).toBe(1);
    sim.dispose();
  });
});
