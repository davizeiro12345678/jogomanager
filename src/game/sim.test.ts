import { describe, expect, it, vi } from "vitest";

import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MatchSim } from "./sim";
import { profileFor } from "./attributes";
import { snapshotMatch, WorkerMatchView } from "./live-match";
import { createRapierBallAuthority } from "./rapier-ball-authority";

function create(seed = "engine-regression") {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed);
}

describe("MatchSim", () => {
  it("carries profile physique through worker snapshots and substitutes", () => {
    const home = buildTeamSetup("fla");
    const away = buildTeamSetup("pal");
    const sim = new MatchSim(home, away, "physique-snapshot");
    const player = sim.players.find((p) => p.side === "home")!;
    const original = home.players.find((p) => p.id === player.pid)!;
    expect(player.heightCm).toBe(profileFor(original).height);
    expect(player.weightKg).toBe(profileFor(original).weight);
    const view = new WorkerMatchView(home, away);
    view.apply(snapshotMatch(sim, 1));
    expect(view.players.find((p) => p.id === player.id)?.heightCm).toBe(player.heightCm);
    const incoming = { ...original, id: "replacement-physique", name: "Replacement", number: 99 };
    expect(sim.substitute("home", player.pid, incoming)).toBe(true);
    const replacement = sim.players.find((p) => p.pid === incoming.id)!;
    expect(replacement.heightCm).toBe(profileFor(incoming).height);
    expect(replacement.weightKg).toBe(profileFor(incoming).weight);
  });
  it("produces the same result from the same seed", () => {
    const first = create();
    const second = create();
    while (!first.finished) first.step(0.5);
    while (!second.finished) second.step(0.5);

    expect(first.stats).toEqual(second.stats);
    expect(first.scorers).toEqual(second.scorers);
    expect(first.shotMap).toEqual(second.shotMap);
  });

  it("keeps goalkeeper contact visuals deterministic and independent of ambient randomness", () => {
    const sim = create("visual-contact-determinism");
    const keeper = sim.players.find((player) => player.side === "home" && player.pos === "GK");
    expect(keeper).toBeDefined();
    if (!keeper) return;

    sim.ball.holder = keeper.id;
    const ambientRandom = vi.spyOn(Math, "random");
    try {
      ambientRandom.mockReturnValueOnce(0);
      const first = sim.generateVisualContext();
      ambientRandom.mockReturnValueOnce(0.99);
      const second = sim.generateVisualContext();
      expect(second).toEqual(first);
    } finally {
      ambientRandom.mockRestore();
    }
  });

  it("keeps halftime kickoff ball height valid in fallback and Rapier runs", async () => {
    const heights: number[] = [];
    for (let run = 0; run < 3; run += 1) {
      const sim = create(`halftime-kickoff-height-${run}`);
      const internals = sim as unknown as { freezeT: number };
      if (run === 2) sim.setBallPhysicsAuthority(await createRapierBallAuthority());
      sim.phase = "half";
      sim.ball.height = 0.12;
      internals.freezeT = 1 / 30;

      sim.step(1 / 30, 6);
      heights.push(sim.ball.height);
      expect(sim.phase).toBe("second");
      sim.dispose();
    }

    expect(heights).toEqual([0.12, 0.12, 0.12]);
  });

  it("finishes safely and keeps diagnostic collections bounded", () => {
    const sim = create("long-match");
    let guard = 0;
    while (!sim.finished && guard++ < 20_000) sim.step(0.5);

    expect(sim.finished).toBe(true);
    // com acréscimos, o apito final sai entre 90' e ~100'
    expect(sim.minute()).toBeGreaterThanOrEqual(90);
    expect(sim.minute()).toBeLessThanOrEqual(105);
    expect(sim.events.length).toBeLessThanOrEqual(80);
    expect(sim.shotMap.length).toBeLessThanOrEqual(120);
    expect(
      sim.players.every((player) => Number.isFinite(player.x) && Number.isFinite(player.z)),
    ).toBe(true);
    expect(Number.isFinite(sim.ball.x) && Number.isFinite(sim.ball.z)).toBe(true);
  });

  it("finishes many seeded matches without a stuck phase", () => {
    for (let index = 0; index < 8; index += 1) {
      const sim = create(`stability-${index}`);
      let guard = 0;
      while (!sim.finished && guard++ < 16_000) sim.step(0.4);
      expect(sim.finished, `seed stability-${index}`).toBe(true);
      expect(guard, `seed stability-${index}`).toBeLessThanOrEqual(16_000);
    }
  });

  it("keeps player acceleration and top speed in a human range", () => {
    const sim = create("movement-envelope");
    let maximumReportedSpeed = 0;
    const dt = 1 / 30;
    for (let tick = 0; tick < 900; tick += 1) {
      sim.step(dt, 6);
      for (const player of sim.players) {
        maximumReportedSpeed = Math.max(maximumReportedSpeed, Math.hypot(player.vx, player.vz));
      }
    }
    expect(maximumReportedSpeed).toBeLessThanOrEqual(7.6);
  });

  it("releases a nominal goal that physically bends outside the posts", () => {
    const sim = create("curved-near-miss");
    const shooter = sim.players.find((player) => player.side === "home" && player.pos !== "GK");
    expect(shooter).toBeDefined();
    if (!shooter) return;

    const internals = sim as unknown as {
      pendingShot: {
        side: "home";
        shooter: string;
        outcome: "goal";
        fromX: number;
        fromZ: number;
        targetZ: number;
      } | null;
      resolveShot: () => boolean;
      looseTime: number;
    };
    sim.ball.holder = null;
    sim.ball.x = FIELD_X - 1;
    sim.ball.z = 3.9;
    sim.ball.height = 1.1;
    sim.ball.vx = 12;
    sim.ball.vz = 1.5;
    internals.pendingShot = {
      side: "home",
      shooter: shooter.id,
      outcome: "goal",
      fromX: 18,
      fromZ: 0,
      targetZ: 3.61,
    };

    expect(internals.resolveShot()).toBe(false);
    expect(internals.pendingShot).toBeNull();

    for (let tick = 0; tick < 30 && !sim.ball.holder; tick += 1) sim.step(0.2);
    expect(sim.ball.holder !== null || internals.looseTime < 3.5).toBe(true);
  });

  it("scores a physical goal when a large step crosses the whole goal plane", () => {
    const sim = create("goal-plane-crossing");
    const shooter = sim.players.find((player) => player.side === "home" && player.pos !== "GK");
    expect(shooter).toBeDefined();
    if (!shooter) return;
    const internals = sim as unknown as {
      pendingShot: {
        side: "home";
        shooter: string;
        outcome: "goal";
        fromX: number;
        fromZ: number;
        targetZ: number;
      } | null;
      resolveShot: (previous: { x: number; z: number; height: number }) => boolean;
    };
    sim.ball.x = FIELD_X + 1;
    sim.ball.z = 0.8;
    sim.ball.height = 1.2;
    internals.pendingShot = {
      side: "home",
      shooter: shooter.id,
      outcome: "goal",
      fromX: 24,
      fromZ: 0,
      targetZ: 0.8,
    };

    expect(internals.resolveShot({ x: FIELD_X - 5, z: 0.2, height: 0.8 })).toBe(true);
    expect(sim.stats.home.goals).toBe(1);
    expect(internals.pendingShot).toBeNull();
  });
});
