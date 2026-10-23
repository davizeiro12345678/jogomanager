import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import { defensiveLineX } from "./sim-rules";
import { activateAdvanced } from "./tactical-plan";
import type { Side, SimPlayer } from "./sim-types";

const prepare = (side: Side, advanced = false) => {
  const sim = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "offside-release");
  if (advanced) sim.home.tactics = activateAdvanced(sim.home.tactics);
  const dir: 1 | -1 = side === "home" ? 1 : -1;
  const mates = sim.players.filter((p) => p.side === side && p.pos !== "GK");
  const holder = mates[0]!;
  const receiver = mates[1]!;
  for (const [index, p] of sim.players.entries()) {
    p.x = -40 * dir;
    p.z = index - 11;
    p.vx = 0;
    p.vz = 0;
  }
  const defenders = sim.players.filter((p) => p.side !== side);
  const keeper = defenders.find((p) => p.pos === "GK")!;
  keeper.x = 40 * dir;
  keeper.z = 0;
  for (const [index, defender] of defenders.filter((p) => p !== keeper).entries()) {
    defender.x = (20 - index * 4) * dir;
    defender.z = 12;
  }
  holder.x = 5 * dir;
  holder.z = 0;
  receiver.x = 15 * dir;
  receiver.z = 0;
  receiver.passing = receiver.physical = receiver.defending = 100;
  sim.time = 10;
  const internal = sim as unknown as {
    decide(player: SimPlayer): void;
    advancedOffside(player: SimPlayer, ballX: number, dir: 1 | -1): boolean;
    controlBall(player: SimPlayer, speed: number, height: number): void;
    restartFor(side: Side, kind: "throwIn" | "indirectFK"): void;
    scheduleRestart(side: Side, goalKick?: boolean): void;
    exemptUntil: number;
    pass: {
      to: string;
      from: string;
      until: number;
      fromX: number;
      dir: 1 | -1;
      side: Side;
      offsideAtKick?: boolean;
      offsideIdsAtKick?: string[];
    } | null;
  };
  internal.exemptUntil = 0;
  return { sim, internal, holder, receiver, dir };
};

describe("offside is measured at release", () => {
  it.each<Side>(["home", "away"])(
    "uses the second-last of at least five %s opponents, including the keeper",
    (side) => {
      const dir = side === "home" ? 1 : -1;
      const opponent: Side = side === "home" ? "away" : "home";
      const players = [-10, 0, 10, 20, 40].map((x, index) => ({
        x: x * dir,
        side: opponent,
        pos: index === 4 ? "GK" : "DF",
        sentOff: false,
      }));
      players.push({ x: 50 * dir, side: opponent, pos: "DF", sentOff: true });
      expect(defensiveLineX(players, side)).toBe(20 * dir);
    },
  );

  it.each([false, true])(
    "chooses a legal alternative instead of a known offside target, advanced=%s",
    (advanced) => {
      const { sim, internal, holder, receiver } = prepare("home", advanced);
      receiver.x = 25;
      const alternative = sim.players.find(
        (p) => p.side === "home" && p !== holder && p !== receiver,
      )!;
      alternative.x = 12;
      alternative.z = 0;
      (internal as unknown as { rnd: () => number }).rnd = () => 0.1;
      internal.decide(holder);
      expect(internal.pass?.to).toBe(alternative.id);
      expect(internal.pass?.offsideAtKick).toBe(false);
      sim.dispose();
    },
  );

  it("keeps possession available to dribble when every reachable teammate is offside", () => {
    const { sim, internal, holder, receiver } = prepare("home");
    receiver.x = 25;
    sim.ball.holder = holder.id;
    internal.decide(holder);
    expect(internal.pass).toBeNull();
    expect(sim.ball.holder).toBe(holder.id);
    sim.dispose();
  });

  it.each(["home", "away"] as const)(
    "records an onside %s default pass before the receiver runs beyond the defenders",
    (side) => {
      const { sim, internal, holder, receiver, dir } = prepare(side);
      internal.decide(holder);
      expect(internal.pass?.to).toBe(receiver.id);
      expect(internal.pass?.offsideAtKick).toBe(false);
      receiver.x = 30 * dir;
      internal.controlBall(receiver, 0, 0.12);
      expect(sim.stats[side].offsides).toBe(0);
      expect(sim.stats[side].passesOk).toBe(1);
      sim.dispose();
    },
  );

  it.each([false, true])(
    "keeps release-time controls with advanced=%s and an in-flight checkpoint",
    (advanced) => {
      const { sim, internal, holder, receiver, dir } = prepare("home", advanced);
      internal.decide(holder);
      expect(internal.pass?.offsideAtKick).toBe(false);
      const checkpoint = sim.checkpoint();
      const recovered = new MatchSim(
        buildTeamSetup("fla"),
        buildTeamSetup("pal"),
        "offside-release",
      );
      recovered.restoreCheckpoint(checkpoint);
      const nextReceiver = recovered.players.find((p) => p.id === receiver.id)!;
      nextReceiver.x = 30 * dir;
      (
        recovered as unknown as { controlBall(p: SimPlayer, speed: number, h: number): void }
      ).controlBall(nextReceiver, 0, 0.12);
      expect(recovered.stats.home.offsides).toBe(0);
      expect(recovered.stats.home.passesOk).toBe(1);
      recovered.dispose();
      sim.dispose();
    },
  );

  it.each<Side>(["home", "away"])(
    "allows a %s receiver behind the ball despite being beyond the second-last opponent",
    (side) => {
      const { sim, internal, holder, receiver, dir } = prepare(side);
      holder.x = 25 * dir;
      receiver.x = 23 * dir;
      expect(internal.advancedOffside(receiver, holder.x, dir)).toBe(false);
      sim.dispose();
    },
  );

  it.each(["throw-in", "goal-kick"])(
    "keeps the direct %s reception exemption after the countdown and flight",
    (kind) => {
      const { sim, internal, holder, receiver } = prepare("home");
      receiver.x = 25;
      if (kind === "throw-in") {
        sim.ball.x = holder.x;
        sim.ball.z = holder.z;
        internal.restartFor("home", "throwIn");
      } else internal.scheduleRestart("home", true);
      const taker = sim.players.find((p) => p.id === sim.ball.holder)!;
      taker.x = 5;
      sim.time += 30;
      internal.decide(taker);
      expect(internal.pass?.offsideAtKick).toBe(false);
      sim.time += 5;
      internal.controlBall(receiver, 0, 0.12);
      expect(sim.stats.home.offsides).toBe(0);
      sim.dispose();
    },
  );

  it.each<Side>(["home", "away"])(
    "penalizes a %s receiver offside at release even after running back",
    (side) => {
      const { sim, internal, holder, receiver, dir } = prepare(side);
      internal.pass = {
        to: receiver.id,
        from: holder.id,
        until: 11,
        fromX: holder.x,
        side,
        dir,
        offsideAtKick: true,
      };
      receiver.x = 4 * dir;
      internal.controlBall(receiver, 0, 0.12);
      expect(sim.stats[side].offsides).toBe(1);
      expect(sim.ball.x).toBe(4 * dir);
      expect(sim.ball.offsideExemptFor).toBeUndefined();
      sim.dispose();
    },
  );

  it.each([false, true])(
    "judges an unintended receiver by their own release position, offside=%s",
    (offside) => {
      const { sim, internal, holder, receiver } = prepare("home");
      const intended = sim.players.find(
        (p) => p.side === "home" && p !== holder && p !== receiver,
      )!;
      internal.pass = {
        from: holder.id,
        to: intended.id,
        side: "home",
        dir: 1,
        fromX: 5,
        until: 11,
        offsideAtKick: !offside,
        offsideIdsAtKick: [offside ? receiver.id : intended.id],
      };
      internal.controlBall(receiver, 0, 0.12);
      expect(sim.stats.home.offsides).toBe(offside ? 1 : 0);
      sim.dispose();
    },
  );

  it.each([
    { ids: ["not-a-player"] },
    { ids: ["duplicate", "duplicate"] },
    { ids: Array(12).fill("too-many") },
  ])("rejects invalid offside release IDs %j", ({ ids }) => {
    const { sim, internal, holder } = prepare("home");
    internal.decide(holder);
    const before = sim.checkpoint();
    const broken = structuredClone(before);
    (broken.state["pass"] as Record<string, unknown>)["offsideIdsAtKick"] = ids;
    expect(() => sim.restoreCheckpoint(broken)).toThrow(/offside/);
    expect(sim.checkpoint()).toEqual(before);
    sim.dispose();
  });

  it("takes an indirect restart as a pass and clears its restriction after release", () => {
    const { sim, internal, holder } = prepare("home");
    sim.ball.x = holder.x;
    sim.ball.z = holder.z;
    internal.restartFor("home", "indirectFK");
    const taker = sim.players.find((p) => p.id === sim.ball.holder)!;
    (sim as unknown as { shoot(p: SimPlayer, distance: number): void }).shoot(taker, 10);
    expect(sim.stats.home.shots).toBe(0);
    internal.decide(taker);
    expect(internal.pass).not.toBeNull();
    expect(sim.ball.indirectFor).toBeUndefined();
    expect(sim.ball.offsideExemptFor).toBeUndefined();
    sim.dispose();
  });

  it.each(["throwIn", "indirectFK"] as const)(
    "preserves the %s restart owner when its taker is substituted before release",
    (kind) => {
      const { sim, internal, holder } = prepare("home");
      sim.ball.x = holder.x;
      sim.ball.z = holder.z;
      internal.restartFor("home", kind);
      const taker = sim.players.find((p) => p.id === sim.ball.holder)!;
      const replacement = sim.home.bench!.find((p) => p.pos === taker.pos)!;
      expect(sim.substitute("home", taker.pid, replacement)).toBe(true);
      const key = kind === "throwIn" ? "offsideExemptFor" : "indirectFor";
      expect(sim.ball[key]).toBe(sim.ball.holder);
      const checkpoint = sim.checkpoint();
      const recovered = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), checkpoint.seed);
      expect(() => recovered.restoreCheckpoint(checkpoint)).not.toThrow();
      recovered.dispose();
      sim.dispose();
    },
  );

  it("accepts an old in-flight checkpoint using the corrected second-last fallback", () => {
    const { sim, internal, holder, receiver } = prepare("home");
    internal.pass = {
      to: receiver.id,
      from: holder.id,
      until: 11,
      fromX: holder.x,
      side: "home",
      dir: 1,
    };
    receiver.x = 15;
    const checkpoint = sim.checkpoint();
    const recovered = new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "offside-release");
    recovered.restoreCheckpoint(checkpoint);
    (
      recovered as unknown as { controlBall(p: SimPlayer, speed: number, h: number): void }
    ).controlBall(
      recovered.players.find((p) => p.id === receiver.id)!,
      0,
      0.12,
    );
    expect(recovered.stats.home.offsides).toBe(0);
    recovered.dispose();
    sim.dispose();
  });
});
