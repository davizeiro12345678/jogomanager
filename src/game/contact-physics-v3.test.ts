import { describe, expect, it, vi } from "vitest";
import { MatchSim, MATCH_SIMULATION_STEP as dt } from "./sim";
import { buildTeamSetup } from "./quickMatch";
import { blockContactEntry, type BallFlightSample } from "./match-physics-extras";
import { createRapierBallAuthority } from "./rapier-ball-authority";
import { ReplayRecorder } from "./replay";
import { encodeReplay, decodeReplay } from "./replay-codec";

const from = { x: -0.9, z: 0, height: 1 },
  to = { x: 0.9, z: 0, height: 1 };
const create = (seed: string, revision: 2 | 3 = 3) =>
  new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, {
    contactPhysicsRevision: revision,
  });
function setup(revision: 2 | 3 = 3) {
  const sim = create("sweep-order", revision);
  const [late, early] = sim.players.filter((p) => p.side === "away" && p.pos !== "GK");
  for (const p of sim.players) p.z = 20;
  Object.assign(late!, { x: 0.35, z: 1.2 });
  Object.assign(early!, { x: -0.35, z: 1.2 });
  const passer = sim.players.find((p) => p.side === "home" && p.pos !== "GK")!;
  sim.ball = { ...to, holder: null, vx: 54, vz: 0 };
  sim.pass = { from: passer.id, to: passer.id, fromX: -3, side: "home", dir: 1, until: 1 };
  sim.lastTouch = "home";
  return { sim, late: late!, early: early! };
}
describe("relative contacts, revision 3", () => {
  it("keeps entry time across 100 translated and mirrored paths", () => {
    for (let i = 0; i < 100; i++) {
      const sign = i % 2 === 0 ? 1 : -1,
        offset = i / 4;
      expect(
        blockContactEntry(
          { ...from, x: offset + sign * from.x },
          { ...to, x: offset + sign * to.x },
          offset - sign * 0.35,
          1.2,
          offset - sign * 0.35,
          1.2,
        ),
      ).toBeCloseTo(1 / 9, 11);
    }
  });
  it("resolves moving defenders, playable height, tangent and initial overlap", () => {
    expect(blockContactEntry(from, to, 0.9, 1.2, 0.4, 1.2)).toBeCloseTo(29 / 46, 12);
    expect(
      blockContactEntry({ ...from, height: 2.15 }, { ...to, height: 1.75 }, 0, 1.2, 0, 1.2),
    ).toBeCloseTo(0.625, 12);
    expect(
      blockContactEntry({ ...from, height: 2.35 }, { ...to, height: 2.05 }, 0, 1.2, 0, 1.2),
    ).toBeNull();
    expect(blockContactEntry(from, to, 0, 1.25, 0, 1.25)).toBeCloseTo(0.5, 12);
    expect(blockContactEntry(from, from, from.x, 0, from.x, 0)).toBe(0);
    expect(blockContactEntry(from, to, NaN, 0, 0, 0)).toBeNull();
  });
  it.each([false, true])(
    "blocks at the first real entry regardless of roster order %s",
    (reverse) => {
      const { sim, early, late } = setup();
      try {
        if (reverse) sim.players.reverse();
        vi.spyOn(sim, "rnd").mockReturnValue(0);
        expect(sim.tryBlock(dt, from)).toBe(true);
        expect(early.tackles).toBe(1);
        expect(late.tackles).toBe(0);
        expect(sim.ball.x).toBeCloseTo(-0.7, 12);
      } finally {
        sim.dispose();
      }
    },
  );
  it("gives a later defender a chance if the first one fails", () => {
    const { sim, early, late } = setup();
    try {
      vi.spyOn(sim, "rnd").mockReturnValueOnce(0.99).mockReturnValue(0);
      expect(sim.tryBlock(dt, from)).toBe(true);
      expect(late.tackles).toBe(1);
      expect(early.tackles).toBe(0);
    } finally {
      sim.dispose();
    }
  });
  it("breaks simultaneous contacts by stable ID and excludes sent-off defenders", () => {
    for (const sendOff of [false, true]) {
      const { sim, early, late } = setup();
      try {
        early.x = late.x;
        const [a, b] = [early, late].sort((l, r) => (l.id < r.id ? -1 : 1));
        a!.sentOff = sendOff;
        vi.spyOn(sim, "rnd").mockReturnValue(0);
        expect(sim.tryBlock(dt, from)).toBe(true);
        expect((sendOff ? b : a)!.tackles).toBe(1);
      } finally {
        sim.dispose();
      }
    }
  });
  it("observes the curved solver path, not the shortcut connecting its endpoints", () => {
    const { sim, late, early } = setup();
    try {
      late.x = 0;
      late.z = 0;
      early.z = 20;
      const rand = vi.spyOn(sim, "rnd").mockReturnValue(0);
      const flight = [
        { x: -2, z: 2, height: 1, time: 0.25 },
        { x: 2, z: 2, height: 1, time: 0.75 },
        { x: 2, z: 0, height: 1, time: 1 },
      ];
      sim.ball.x = 2;
      expect(sim.tryBlock(dt, { x: -2, z: 0, height: 1 }, undefined, flight)).toBe(false);
      expect(rand).not.toHaveBeenCalled();
    } finally {
      sim.dispose();
    }
  });
  it.each([
    { revision: 2 as const, z: 1.7, tackle: false },
    { revision: 3 as const, z: 1.7, tackle: true },
    { revision: 3 as const, z: -1.7, tackle: false },
    { revision: 3 as const, z: 2.0, tackle: false },
  ])(
    "gates standing pressure by actual foot reach at center distance $z in revision $revision",
    ({ revision, z, tackle }) => {
      const sim = create("physical-duel", revision);
      try {
        for (const p of sim.players) {
          p.x = 15;
          p.z = 15;
        }
        const holder = sim.players.find((p) => p.side === "home" && p.pos !== "GK")!;
        const challenger = sim.players.find((p) => p.side === "away" && p.pos !== "GK")!;
        Object.assign(holder, { x: 0, z: 0 });
        Object.assign(challenger, { x: 0, z });
        Object.assign(sim.ball, { holder: holder.id, x: 0, z: 0.9, height: 0.12 });
        sim.restartTimer = 0;
        const rng = vi.spyOn(sim, "rnd").mockReturnValueOnce(0).mockReturnValue(0.99);
        sim.pressure(holder, dt);
        expect(challenger.tackles).toBe(tackle ? 1 : 0);
        expect(sim.ball.holder).toBe(tackle ? challenger.id : holder.id);
        if (!tackle) expect(rng).not.toHaveBeenCalled();
      } finally {
        sim.dispose();
      }
    },
  );
  it("skips expelled and shielded challengers and keeps a restart protected", () => {
    const sim = create("pressure-contenders");
    try {
      for (const p of sim.players) {
        p.x = 15;
        p.z = 15;
      }
      const holder = sim.players.find((p) => p.side === "home" && p.pos !== "GK")!;
      const [shielded, expelled, reachable] = sim.players.filter(
        (p) => p.side === "away" && p.pos !== "GK",
      );
      Object.assign(holder, { x: 0, z: 0 });
      Object.assign(shielded!, { x: 0, z: -1.7 });
      sim.sendOff(expelled!, "fixture");
      Object.assign(expelled!, { x: 0, z: 1.5 });
      Object.assign(reachable!, { x: 0, z: 1.85 });
      Object.assign(sim.ball, { holder: holder.id, x: 0, z: 0.9, height: 0.12 });
      const rng = vi.spyOn(sim, "rnd").mockReturnValueOnce(0).mockReturnValue(0.99);
      sim.restartTimer = 1;
      sim.pressure(holder, dt);
      expect(rng).not.toHaveBeenCalled();
      sim.restartTimer = 0;
      sim.pressure(holder, dt);
      expect(sim.ball.holder).toBe(reachable!.id);
      expect(shielded!.tackles + expelled!.tackles).toBe(0);
    } finally {
      sim.dispose();
    }
  });
  it("tracks a real Rapier post reversal without integrating the ball twice", async () => {
    const physics = await createRapierBallAuthority(),
      control = await createRapierBallAuthority();
    const ball = { x: 49.95, z: 3.66, height: 1.22, vx: 14, vy: 0, vz: 0, spin: 0, holder: null },
      compare = { ...ball };
    try {
      const path: BallFlightSample[] = [];
      physics.step(0.2, ball, null, path);
      control.step(0.2, compare, null);
      expect(ball).toEqual(compare);
      expect(path[0]!.x).toBeGreaterThan(49.95);
      expect(path.some((p, i) => i > 0 && p.x < path[i - 1]!.x)).toBe(true);
      expect(path.at(-1)).toMatchObject({ time: 1, x: ball.x, z: ball.z, height: ball.height });
    } finally {
      physics.dispose();
      control.dispose();
    }
  });
  it.each([false, true])(
    "keeps the revision through checkpoints and stored replay with Rapier %s",
    async (rapier) => {
      const sim = create("contact3-save"),
        recovered = create("contact3-save");
      try {
        if (rapier) sim.setBallPhysicsAuthority(await createRapierBallAuthority());
        for (let i = 0; i < 90; i++) sim.step(dt, 6);
        const point = sim.checkpoint();
        expect(point.execution?.contactPhysicsRevision).toBe(3);
        recovered.restoreCheckpoint(point, rapier ? await createRapierBallAuthority() : undefined);
        for (let i = 0; i < 90; i++) {
          sim.step(dt, 6);
          recovered.step(dt, 6);
        }
        expect(recovered.checkpoint()).toEqual(sim.checkpoint());
        const recorder = new ReplayRecorder(sim);
        recorder.sample();
        const replay = decodeReplay(encodeReplay(recorder.build("Contact 3")));
        expect(replay.execution).toEqual(sim.executionContract());
      } finally {
        sim.dispose();
        recovered.dispose();
      }
    },
  );
});
