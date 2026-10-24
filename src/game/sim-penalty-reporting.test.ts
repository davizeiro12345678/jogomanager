import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim, FIELD_X } from "./sim";
import type { SimPlayer } from "./sim-types";

type Internals = {
  setupPenalty(side: "home"): void;
  takePenalty(): void;
  pendingShot: { shooter: string; outcome: "goal" | "saved" | "off"; penalty?: true };
  resolveShot(previous: { x: number; z: number; height: number }): boolean;
  tryBlock(dt: number): boolean;
  controlBall(p: SimPlayer, speed: number, height: number): void;
  finishMatch(): void;
};
const kick = () => {
  for (let seed = 0; seed < 32; seed++) {
    const sim = new MatchSim(
      buildTeamSetup("fla"),
      buildTeamSetup("pal"),
      `penalty-report-${seed}`,
    );
    const internal = sim as unknown as Internals;
    internal.setupPenalty("home");
    internal.takePenalty();
    if (internal.pendingShot.outcome === "goal")
      return {
        sim,
        internal,
        shooter: sim.players.find((p) => p.id === internal.pendingShot.shooter)!,
      };
    sim.dispose();
  }
  throw new Error("No nominal-goal fixture found");
};
const resolve = (sim: MatchSim, internal: Internals, kind: "goal" | "save" | "off" | "block") => {
  sim.ball.x = FIELD_X + 0.2;
  sim.ball.z = kind === "off" ? 7 : 0;
  sim.ball.height = 0.5;
  if (kind === "block") {
    sim.ball.x = 45;
    sim.ball.vx = 20;
    sim.ball.vz = 0;
    const defender = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
    defender.x = sim.ball.x;
    defender.z = sim.ball.z;
    for (let n = 0; n < 32 && internal.pendingShot; n++) internal.tryBlock(1 / 30);
    expect(internal.pendingShot).toBeNull();
  } else {
    if (kind === "save") internal.pendingShot.outcome = "saved";
    internal.resolveShot({ x: 50, z: sim.ball.z, height: 0.5 });
  }
};

describe("penalty personal statistics follow physical resolution", () => {
  it("keeps both counters pending before resolution", () => {
    const { sim, shooter } = kick();
    expect(shooter.pensScored).toBe(0);
    expect(shooter.pensMissed).toBe(0);
    sim.dispose();
  });

  it.each(["goal", "save", "off", "block"] as const)("records the actual %s once", (kind) => {
    const { sim, internal, shooter } = kick();
    resolve(sim, internal, kind);
    expect(shooter.pensScored).toBe(kind === "goal" ? 1 : 0);
    expect(shooter.pensMissed).toBe(kind === "goal" ? 0 : 1);
    internal.finishMatch();
    expect(shooter.pensScored + shooter.pensMissed).toBe(1);
    sim.dispose();
  });

  it.each(["goal", "save", "block"] as const)(
    "resumes a pending %s without double counting",
    (kind) => {
      const { sim, internal, shooter } = kick();
      const checkpoint = sim.checkpoint();
      const recovered = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), checkpoint.seed);
      recovered.restoreCheckpoint(checkpoint);
      resolve(sim, internal, kind);
      resolve(recovered, recovered as unknown as Internals, kind);
      expect(recovered.checkpoint()).toEqual(sim.checkpoint());
      expect(recovered.players.find((p) => p.id === shooter.id)!.pensScored).toBe(
        kind === "goal" ? 1 : 0,
      );
      recovered.dispose();
      sim.dispose();
    },
  );

  it("does not count an armed but untaken kick", () => {
    const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "untaken-penalty");
    const internal = sim as unknown as Internals;
    internal.setupPenalty("home");
    internal.finishMatch();
    expect(sim.stats.home.pens).toBe(0);
    expect(sim.players.reduce((n, p) => n + p.pensScored + p.pensMissed, 0)).toBe(0);
    sim.dispose();
  });

  it("counts an opponent's controlled interception as a missed attempt exactly once", () => {
    const { sim, internal, shooter } = kick();
    const defender = sim.players.find((p) => p.side === "away" && p.pos === "DF")!;
    (internal as unknown as { rnd: () => number }).rnd = () => 0;
    internal.controlBall(defender, 0, 0.12);
    internal.finishMatch();
    expect(shooter.pensScored).toBe(0);
    expect(shooter.pensMissed).toBe(1);
    sim.dispose();
  });

  it("attributes the final penalty conversion after substituting the taker in flight", () => {
    const { sim, internal, shooter } = kick();
    const incoming = sim.home.bench!.find((p) => p.pos === shooter.pos)!;
    expect(sim.substitute("home", shooter.pid, incoming)).toBe(true);
    resolve(sim, internal, "goal");
    expect(sim.subsOut.find((p) => p.id === shooter.id)!.pensScored).toBe(1);
    expect(sim.subsOut.find((p) => p.id === shooter.id)!.pensMissed).toBe(0);
    sim.dispose();
  });

  it("retains already-counted legacy unmarked attempts", () => {
    const { sim, internal, shooter } = kick();
    delete internal.pendingShot.penalty;
    shooter.pensScored = 1;
    resolve(sim, internal, "goal");
    expect(shooter.pensScored).toBe(1);
    expect(shooter.pensMissed).toBe(0);
    sim.dispose();
  });

  it.each([false, "penalty", 1])(
    "rejects an invalid optional penalty marker %s atomically",
    (marker) => {
      const { sim } = kick();
      const before = sim.checkpoint();
      const broken = structuredClone(before);
      (broken.state["pendingShot"] as Record<string, unknown>)["penalty"] = marker;
      expect(() => sim.restoreCheckpoint(broken)).toThrow(/penalty|shot/i);
      expect(sim.checkpoint()).toEqual(before);
      sim.dispose();
    },
  );
});
