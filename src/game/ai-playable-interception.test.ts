import { describe, expect, it } from "vitest";
import { firstPlayableInterception } from "./ai-playable-interception";
import { snapshotMatch } from "./live-match";
import { validMatchCommand } from "./match-command-validation";
import { recoverMatch } from "./match-recovery";
import { buildTeamSetup } from "./quickMatch";
import { createRapierBallAuthority } from "./rapier-ball-authority";
import { ReplayRecorder } from "./replay";
import { decodeReplay, encodeReplay } from "./replay-codec";
import { MatchSim } from "./sim";

function fixture(revision: 2 | 3 = 3, contact: 2 | 3 = 2) {
  const home = buildTeamSetup("fla", "4-3-3", 2, 1, { tacticalAiRevision: revision });
  const away = buildTeamSetup("pal", "4-4-2", 2, 1, { tacticalAiRevision: 2 });
  const sim = new MatchSim(home, away, "chaser-integration", {
    rulesRevision: 2,
    contactPhysicsRevision: contact,
  });
  const [runner, closer, closest] = sim.players.filter((p) => p.side === "home" && p.pos !== "GK");
  for (const player of sim.players) {
    Object.assign(player, {
      x: -40,
      z: 20,
      vx: 0,
      vz: 0,
      pace: 90,
      stamina: 100,
      physical: 80,
      weightKg: 78,
    });
  }
  Object.assign(runner!, { x: 0, z: 0, vx: 6 });
  Object.assign(closer!, { x: 0.5, z: 0 });
  Object.assign(closest!, { x: 1, z: 0 });
  Object.assign(sim.ball, { x: 6, z: 0, vx: 0, vz: 0, height: 0.12, holder: null });
  sim.ballVy = 0;
  sim.restartTimer = 0;
  return { sim, runner: runner!, closer: closer!, closest: closest! };
}

describe("team pursuit revision 3", () => {
  it("selects the runner crossing the loose-ball sector and keeps teammates in formation", () => {
    const { sim, runner, closer, closest } = fixture();
    expect([...sim.chasers()].filter((id) => id.startsWith("home"))).toEqual([runner.id]);
    const before = fixture(2);
    expect(before.sim.chasers().has(before.closer.id)).toBe(true);
    expect(before.sim.chasers().has(before.closest.id)).toBe(true);
    expect(before.sim.chasers().has(before.runner.id)).toBe(false);
    expect(sim.chasers().has(closer.id)).toBe(false);
    expect(sim.chasers().has(closest.id)).toBe(false);
    expect([...sim.chasers()].filter((id) => id.startsWith("away"))).toHaveLength(2);
    sim.dispose();
    before.sim.dispose();
  });

  it("chooses the first playable height and rejects unavailable runners", () => {
    const { sim, runner, closer, closest } = fixture();
    runner.pos = "GK";
    closest.sentOff = true;
    const targets = () =>
      firstPlayableInterception(sim.ball, sim.ballVy, sim.players, "home", 1, 2);
    sim.ball.height = 5;
    Object.assign(closer, { x: sim.ball.x });
    expect(targets()).toEqual({ id: closer.id, x: sim.ball.x, z: 0, time: 0.8 });
    sim.ball.height = 12;
    sim.ballVy = 20;
    expect(targets()).toBeNull();
    sim.dispose();
  });

  it("preserves assigned pass, shot and restart runs until a loose ball is available", () => {
    const { sim, runner, closest } = fixture();
    const previous = fixture(2);
    sim.pass = {
      from: runner.id,
      to: closest.id,
      until: sim.time + 0.45,
      side: "home",
      dir: 1,
      fromX: 0,
    };
    expect([...sim.chasers()]).toEqual([...previous.sim.chasers()]);
    sim.pass = null;
    sim.pendingShot = {
      side: "home",
      shooter: runner.id,
      outcome: "saved",
      fromX: 0,
      fromZ: 0,
      targetZ: 1,
      xg: 0.1,
      bigChance: false,
      bodyPart: "foot",
    };
    expect([...sim.chasers()]).toEqual([...previous.sim.chasers()]);
    sim.pendingShot = null;
    sim.restartTimer = 1;
    expect([...sim.chasers()]).toEqual([...previous.sim.chasers()]);
    sim.restartTimer = 0;
    expect(sim.chasers().has(runner.id)).toBe(true);
    sim.dispose();
    previous.sim.dispose();
  });

  it("breaks exact sector ties by athlete ID independently of lineup order", () => {
    const { sim, closer, closest } = fixture();
    Object.assign(closer, { x: 6 });
    Object.assign(closest, { x: 6 });
    const target = () => firstPlayableInterception(sim.ball, 0, sim.players, "home", 1, 2);
    const first = target();
    expect(first?.id).toBe([closer.id, closest.id].sort()[0]);
    sim.players.reverse();
    expect(target()).toEqual(first);
    sim.dispose();
  });

  it("requires a genuinely reachable foot position with either refined contact model", () => {
    const { sim, runner } = fixture();
    try {
      const ball = { ...sim.ball, x: 0, z: 0, vx: 0, vz: 0, height: 0.12 };
      Object.assign(runner, { x: 1.5, z: 0, vx: 0, vz: 0, sentOff: false });
      const resolve = (contact: 2 | 3 | null) =>
        firstPlayableInterception(ball, 0, [runner], "home", 1, contact);
      expect(resolve(null)?.time).toBe(0);
      expect(resolve(3)).toEqual(resolve(2));
      expect(resolve(3)?.time).toBeGreaterThan(0);
    } finally {
      sim.dispose();
    }
  });

  it.each([
    [false, 2],
    [true, 2],
    [false, 3],
    [true, 3],
  ] as const)(
    "preserves per-team selection, replay and the recovery continuation (Rapier %s, contact %s)",
    async (rapier, contact) => {
      const { sim } = fixture(3, contact);
      let restored: MatchSim | undefined;
      try {
        if (rapier) sim.setBallPhysicsAuthority(await createRapierBallAuthority());
        expect(
          validMatchCommand({
            id: 0,
            type: "startLive",
            home: sim.home,
            away: sim.away,
            seed: "v3",
            contactPhysicsRevision: contact,
          }),
        ).toBe(true);
        expect(
          validMatchCommand({
            id: 0,
            type: "startLive",
            home: { ...sim.home, tacticalAiRevision: 4 },
            away: sim.away,
            seed: "v3",
            contactPhysicsRevision: contact,
          }),
        ).toBe(false);
        const recorder = new ReplayRecorder(sim);
        for (let i = 0; i < 90; i++) {
          sim.step(1 / 30, 6);
          recorder.sample();
        }
        const replay = decodeReplay(encodeReplay(recorder.build("Pursuit")));
        expect(replay.execution?.contactPhysicsRevision).toBe(contact);
        expect(replay.home.tacticalAiRevision).toBe(3);
        expect(replay.away.tacticalAiRevision).toBe(2);
        const checkpoint = sim.checkpoint();
        expect(checkpoint.execution?.contactPhysicsRevision).toBe(contact);
        const ticks: [number, number][] = [];
        for (let i = 0; i < 40; i++) {
          sim.step(1 / 30, 6);
          ticks.push([1 / 30, 6]);
        }
        restored = await recoverMatch(
          checkpoint,
          { ...snapshotMatch(sim, 2), recovery: { checkpointSeq: 1, ticks } },
          () => false,
        );
        for (let i = 0; i < 100; i++) {
          sim.step(1 / 30, 6);
          restored.step(1 / 30, 6);
        }
        expect(restored.checkpoint()).toEqual(sim.checkpoint());
      } finally {
        sim.dispose();
        restored?.dispose();
      }
    },
  );
});
