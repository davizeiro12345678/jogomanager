import { describe, expect, it } from "vitest";

import { pitchCondition, windFor } from "./ball-climate";
import { snapshotMatch, WorkerMatchView } from "./live-match";
import { buildTeamSetup } from "./quickMatch";
import { FIELD_X, MatchSim } from "./sim";
import { GOAL_Z, woodworkAt } from "./sim-rules";

function create(seed = "mega-engine", weather: "clear" | "rain" | "heat" = "clear") {
  return new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), seed, { weather });
}

describe("windFor", () => {
  it("is deterministic per seed and bounded", () => {
    const a = windFor("wind-seed");
    const b = windFor("wind-seed");
    expect(a).toEqual(b);
    expect(Math.hypot(a.x, a.z)).toBeLessThanOrEqual(2.21);
    expect(a.strength01).toBeGreaterThanOrEqual(0);
    expect(a.strength01).toBeLessThanOrEqual(1);
  });

  it("is calm most of the time", () => {
    let calm = 0;
    for (let index = 0; index < 200; index += 1) {
      if (Math.hypot(windFor(`dist-${index}`).x, windFor(`dist-${index}`).z) <= 0.5) calm += 1;
    }
    expect(calm).toBeGreaterThan(100);
  });
});

describe("pitchCondition", () => {
  it("keeps clear identical to the legacy physics constants", () => {
    expect(pitchCondition("clear")).toMatchObject({
      airDrag: 0.28,
      rollDrag: 1.5,
      bounce: 0.52,
      skid: 0.82,
    });
  });

  it("makes rain skid and heat bounce", () => {
    expect(pitchCondition("rain").skid).toBeGreaterThan(pitchCondition("clear").skid);
    expect(pitchCondition("rain").bounce).toBeLessThan(pitchCondition("clear").bounce);
    expect(pitchCondition("heat").bounce).toBeGreaterThan(pitchCondition("clear").bounce);
    expect(pitchCondition("heat").rollDrag).toBeGreaterThan(pitchCondition("clear").rollDrag);
  });
});

describe("woodworkAt", () => {
  it("detects posts, bar and clean misses", () => {
    expect(woodworkAt(GOAL_Z, 1)).toBe("post");
    expect(woodworkAt(-GOAL_Z, 0.5)).toBe("post");
    expect(woodworkAt(0, 2.44)).toBe("bar");
    expect(woodworkAt(0, 1)).toBeNull();
    expect(woodworkAt(8, 1)).toBeNull();
    expect(woodworkAt(0, 5)).toBeNull();
  });
});

describe("MatchSim climate", () => {
  it("exposes the seeded wind without touching the main stream", () => {
    const sim = create("wind-wiring");
    expect(sim.wind).toEqual(windFor("wind-wiring"));
    expect(sim.weather).toBe("clear");
  });

  it("pushes an airborne loose ball downwind on the compat path", () => {
    let seed = "wind-push";
    for (let index = 0; index < 50 && Math.abs(windFor(seed).x) < 0.5; index += 1) {
      seed = `wind-push-${index}`;
    }
    const sim = create(seed);
    const wind = windFor(seed);
    expect(Math.abs(wind.x)).toBeGreaterThan(0.4);
    sim.ball.holder = null;
    sim.ball.x = 0;
    sim.ball.z = 0;
    sim.ball.height = 5;
    sim.ball.vx = 0;
    sim.ball.vz = 0;
    (sim as unknown as { ballVy: number }).ballVy = 0;
    sim.step(0.1, 1, false);
    expect(Math.sign(sim.ball.vx)).toBe(Math.sign(wind.x));
    expect(Math.abs(sim.ball.vx)).toBeGreaterThan(0);
    expect(sim.ball.vx).toBeCloseTo(wind.x * 0.1 * Math.exp(-0.28 * 0.1), 3);
  });

  it("bounces dead on rain and lively on heat", () => {
    for (const [weather, expected] of [
      ["rain", 0.38],
      ["heat", 0.58],
    ] as const) {
      const sim = create(`bounce-${weather}`, weather);
      // ponto mais vazio do campo para ninguém agarrar a bola no passo
      let spot = { x: 40, z: 20 };
      let best = -1;
      for (let gx = -40; gx <= 40; gx += 10) {
        for (let gz = -25; gz <= 25; gz += 10) {
          const nearest = Math.min(...sim.players.map((p) => Math.hypot(p.x - gx, p.z - gz)));
          if (nearest > best) {
            best = nearest;
            spot = { x: gx, z: gz };
          }
        }
      }
      sim.ball.holder = null;
      sim.ball.x = spot.x;
      sim.ball.z = spot.z;
      sim.ball.vx = 0;
      sim.ball.vz = 0;
      sim.ball.height = 0.2;
      (sim as unknown as { ballVy: number }).ballVy = -5;
      sim.step(0.05, 1, false);
      // impacto inclui a gravidade do passo: (5 + 9.81*0.05) * bounce
      expect((sim as unknown as { ballVy: number }).ballVy).toBeCloseTo(5.4905 * expected, 1);
    }
  });

  it("stays deterministic with wind, dissent and crowd in play", () => {
    const first = create("mega-determinism");
    const second = create("mega-determinism");
    while (!first.finished) first.step(0.5);
    while (!second.finished) second.step(0.5);
    expect(first.stats).toEqual(second.stats);
    expect(first.events.map((event) => event.text)).toEqual(
      second.events.map((event) => event.text),
    );
  });
});

describe("woodwork event", () => {
  it("logs a post hit and keeps the ball live off the post", () => {
    const sim = create("post-hit");
    const shooter = sim.players.find((player) => player.side === "home" && player.pos !== "GK");
    expect(shooter).toBeDefined();
    if (!shooter) return;
    const internals = sim as unknown as {
      pendingShot: {
        side: "home";
        shooter: string;
        outcome: "off";
        fromX: number;
        fromZ: number;
        targetZ: number;
        xg: number;
        bigChance: boolean;
        bodyPart: "foot";
      } | null;
      resolveShot: (previous: { x: number; z: number; height: number }) => boolean;
    };
    sim.ball.holder = null;
    sim.ball.x = FIELD_X - 1.5;
    sim.ball.z = GOAL_Z;
    sim.ball.height = 1;
    sim.ball.vx = 12;
    sim.ball.vz = 0;
    (sim as unknown as { lastAuthoritative: boolean }).lastAuthoritative = false;
    internals.pendingShot = {
      side: "home",
      shooter: shooter.id,
      outcome: "off",
      fromX: 24,
      fromZ: 0,
      targetZ: GOAL_Z,
      xg: 0.2,
      bigChance: false,
      bodyPart: "foot",
    };

    expect(internals.resolveShot({ x: FIELD_X - 5, z: GOAL_Z, height: 1 })).toBe(false);
    expect(internals.pendingShot).toBeNull();
    expect(sim.events.some((event) => event.type === "post")).toBe(true);
    expect(sim.ball.vx).toBeLessThan(0);
    expect(sim.ball.holder).toBeNull();
    expect(sim.shotMap.at(-1)?.result).toBe("off");
  });
});

describe("applyTeamTalk", () => {
  it("applies morale/stamina bonuses once per side", () => {
    const sim = create("team-talk");
    const before = sim.home.morale ?? 70;
    expect(sim.applyTeamTalk("home", "motivar")).toBe(true);
    expect(sim.home.morale).toBe(Math.min(100, before + 6));
    expect(sim.applyTeamTalk("home", "cobrar")).toBe(false);
    expect(sim.home.morale).toBe(Math.min(100, before + 6));
    expect(sim.applyTeamTalk("away", "poupar")).toBe(true);
    expect(sim.events.filter((event) => event.type === "talk")).toHaveLength(2);
  });
});

describe("crowdPush", () => {
  it("lifts home stamina once when not winning after 75'", () => {
    const sim = create("crowd-push");
    sim.phase = "second";
    sim.time = 76 * 60;
    const player = sim.players.find((p) => p.side === "home" && !p.sentOff);
    expect(player).toBeDefined();
    if (!player) return;
    player.stamina = 50;
    sim.step(0.1);
    expect(player.stamina).toBeCloseTo(56, 1);
    expect(sim.events.some((event) => event.type === "crowd")).toBe(true);
    player.stamina = 50;
    sim.step(0.1);
    expect(player.stamina).toBeCloseTo(50, 1);
  });

  it("stays silent when home is winning", () => {
    const sim = create("crowd-quiet");
    sim.phase = "second";
    sim.time = 80 * 60;
    sim.stats.home.goals = 2;
    sim.step(0.1);
    expect(sim.events.some((event) => event.type === "crowd")).toBe(false);
  });
});

describe("climate snapshot", () => {
  it("carries wind from the sim to the worker view", () => {
    const sim = create("snapshot-wind");
    const view = new WorkerMatchView(sim.home, sim.away);
    view.apply(snapshotMatch(sim, 0));
    expect(view.wind).toEqual(sim.wind);
    expect(view.weather).toBe("clear");
  });
});
