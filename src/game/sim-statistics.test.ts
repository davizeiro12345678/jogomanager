import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, GOAL_Z, MatchSim, type Side } from "./sim";

describe("canonical match statistics", () => {
  it("stops counting a dismissed player's minutes when the red card is shown", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "red-card-minutes");
    const player = sim.players.find((p) => p.side === "home" && p.pos === "DF")!;
    sim.time = 23 * 60;
    (sim as unknown as { sendOff(athlete: typeof player, reason: string): void }).sendOff(
      player,
      "teste",
    );
    sim.time = 95 * 60;
    expect(sim.playerRatings().find((rating) => rating.pid === player.pid)!.minutes).toBe(23);
    sim.dispose();
  });

  it("counts only the substitute's own stint before a dismissal", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "sub-red-minutes");
    const outgoing = sim.players.find((p) => p.side === "home" && p.pos === "DF")!;
    const incoming = sim.home.bench!.find((p) => p.pos === "DF")!;
    sim.time = 60 * 60;
    expect(sim.substitute("home", outgoing.pid, incoming)).toBe(true);
    sim.time = 74 * 60;
    const substitute = sim.players.find((p) => p.pid === incoming.id)!;
    (sim as unknown as { sendOff(player: typeof substitute, reason: string): void }).sendOff(
      substitute,
      "teste",
    );
    sim.time = 95 * 60;
    expect(sim.playerRatings().find((rating) => rating.pid === incoming.id)!.minutes).toBe(14);
    expect(sim.playerRatings().find((rating) => rating.pid === outgoing.pid)!.minutes).toBe(60);
    sim.dispose();
  });

  it("attributes an in-flight goal and assist after both athletes were substituted", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "sub-flight-credit");
    const shooter = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    const provider = sim.players.find((p) => p.side === "home" && p.pos === "MF")!;
    const nextForward = sim.home.bench!.find((p) => p.pos === "FW")!;
    const nextMidfielder = sim.home.bench!.find((p) => p.pos === "MF")!;
    const internals = sim as unknown as {
      shoot(player: typeof shooter, distance: number): void;
      pendingShot: { outcome: "goal" };
      lastPass: { home: { id: string; time: number } };
      resolveShot(previous: { x: number; z: number; height: number }): boolean;
    };
    sim.time = 60 * 60;
    internals.lastPass.home = { id: provider.id, time: sim.time - 1 };
    internals.shoot(shooter, 20);
    internals.pendingShot.outcome = "goal";
    expect(sim.substitute("home", shooter.pid, nextForward)).toBe(true);
    expect(sim.substitute("home", provider.pid, nextMidfielder)).toBe(true);
    sim.ball.x = FIELD_X + 0.2;
    sim.ball.z = 0;
    sim.ball.height = 1;
    expect(internals.resolveShot({ x: FIELD_X - 5, z: 0, height: 1 })).toBe(true);
    expect(sim.stats.home.goals).toBe(1);
    expect(sim.playerRatings().find((p) => p.pid === shooter.pid)!.goals).toBe(1);
    expect(sim.playerRatings().find((p) => p.pid === provider.pid)!.assists).toBe(1);
    expect(sim.scorers).toMatchObject([{ side: "home", name: shooter.name }]);
    expect(sim.shotMap).toMatchObject([{ result: "goal", name: shooter.name }]);
    sim.dispose();
  });

  it("updates the same pending attempt after a checkpoint recovery", () => {
    const create = () =>
      new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "shot-map-recovery");
    const original = create();
    const shooter = original.players.find((p) => p.side === "home" && p.pos === "FW")!;
    const before = original as unknown as {
      shoot(player: typeof shooter, distance: number): void;
      pendingShot: { outcome: "saved" };
    };
    before.shoot(shooter, 20);
    before.pendingShot.outcome = "saved";
    const recovered = create();
    recovered.restoreCheckpoint(original.checkpoint());
    recovered.ball.x = FIELD_X + 0.2;
    recovered.ball.z = 0;
    recovered.ball.height = 1;
    const after = recovered as unknown as {
      resolveShot(previous: { x: number; z: number; height: number }): boolean;
    };
    expect(after.resolveShot({ x: FIELD_X - 5, z: 0, height: 1 })).toBe(true);
    expect(recovered.stats.home.shots).toBe(1);
    expect(recovered.stats.away.saves).toBe(1);
    expect(recovered.shotMap).toHaveLength(1);
    expect(recovered.shotMap[0]).toMatchObject({ side: "home", result: "saved" });
    original.dispose();
    recovered.dispose();
  });

  it("keeps a shot in the shot map when a defender blocks its flight", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "blocked-shot-map");
    const shooter = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    const defender = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
    const internals = sim as unknown as {
      rnd: () => number;
      shoot(player: typeof shooter, distance: number): void;
      tryBlock(dt: number): boolean;
    };
    internals.rnd = () => 0;
    sim.ball.x = shooter.x;
    sim.ball.z = shooter.z;
    internals.shoot(shooter, 20);
    defender.x = sim.ball.x;
    defender.z = sim.ball.z;
    expect(internals.tryBlock(1 / 30)).toBe(true);
    expect(sim.stats.home.shots).toBe(1);
    expect(sim.shotMap).toHaveLength(1);
    expect(sim.shotMap[0]).toMatchObject({ side: "home", result: "off", name: shooter.name });
    sim.dispose();
  });

  it("records an off-target shot that hits the woodwork only once", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "woodwork-shot-map");
    const shooter = sim.players.find((p) => p.side === "home" && p.pos === "FW")!;
    const internals = sim as unknown as {
      rnd: () => number;
      shoot(player: typeof shooter, distance: number): void;
      pendingShot: unknown;
      woodworkOrRelease(
        shot: unknown,
        player: typeof shooter,
        z: number,
        height: number,
        dir: number,
      ): boolean;
    };
    internals.rnd = () => 0.99;
    internals.shoot(shooter, 20);
    expect(sim.shotMap).toHaveLength(1);
    internals.woodworkOrRelease(internals.pendingShot, shooter, GOAL_Z, 1, 1);
    expect(sim.stats.home.shots).toBe(1);
    expect(sim.shotMap).toHaveLength(1);
    sim.dispose();
  });

  it.each(["home", "away"] as const)(
    "credits a saved %s shot to the defending team as well as its goalkeeper",
    (side) => {
      const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "team-saves");
      const defending: Side = side === "home" ? "away" : "home";
      const shooter = sim.players.find((p) => p.side === side && p.pos === "FW")!;
      const keeper = sim.players.find((p) => p.side === defending && p.pos === "GK")!;
      const direction = side === "home" ? 1 : -1;
      const internals = sim as unknown as {
        pendingShot: {
          side: Side;
          shooter: string;
          outcome: "saved";
          fromX: number;
          fromZ: number;
          targetZ: number;
          xg: number;
          bigChance: boolean;
          bodyPart: "foot";
        };
        resolveShot(previous: { x: number; z: number; height: number }): boolean;
      };
      sim.stats[side].shots = 1;
      internals.pendingShot = {
        side,
        shooter: shooter.id,
        outcome: "saved",
        fromX: direction * 30,
        fromZ: 0,
        targetZ: 0,
        xg: 0.15,
        bigChance: false,
        bodyPart: "foot",
      };
      sim.ball.x = direction * (FIELD_X + 0.2);
      sim.ball.z = 0;
      sim.ball.height = 1;
      expect(internals.resolveShot({ x: direction * (FIELD_X - 5), z: 0, height: 1 })).toBe(true);
      expect(keeper.saves).toBe(1);
      expect(sim.stats[side].onTarget).toBe(1);
      expect(sim.stats[defending].saves).toBe(1);
      expect(sim.stats[side].saves).toBe(0);
      expect(sim.shotMap).toMatchObject([{ side, result: "saved" }]);
      sim.dispose();
    },
  );
});
