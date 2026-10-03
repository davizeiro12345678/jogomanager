import { describe, expect, it } from "vitest";

import { snapshotMatch, WorkerMatchView } from "./live-match";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import type { VisualBallState } from "./visual-ball";

function fixture() {
  const home = buildTeamSetup("fla");
  const away = buildTeamSetup("pal");
  return { home, away, sim: new MatchSim(home, away, "visual-ball-snapshot") };
}

describe("live visual-ball snapshots", () => {
  it("serializes an optional visual pose without mutating the canonical match ball", () => {
    const { sim } = fixture();
    const canonicalBefore = { ...sim.ball };
    const visual = Object.freeze({
      x: 4.2,
      z: -1.6,
      height: 1.35,
      vx: 8.4,
      vy: 2.1,
      vz: -0.7,
      spin: 3.3,
    }) as VisualBallState;

    const snapshot = snapshotMatch(sim, 7, visual);

    expect(snapshot.visualBall).toEqual(visual);
    expect(snapshot.visualBall).not.toBe(visual);
    expect(sim.ball).toEqual(canonicalBefore);
  });

  it("interpolates the visual pose when present and falls back to the canonical ball when absent", () => {
    const { home, away, sim } = fixture();
    const view = new WorkerMatchView(home, away);
    const visual: VisualBallState = {
      x: 10,
      z: 2,
      height: 0.8,
      vx: 6,
      vy: 1,
      vz: -2,
      spin: 2,
    };

    view.apply(snapshotMatch(sim, 1, visual));
    view.renderTick(performance.now() + 300);
    expect(view.visualBall).toMatchObject(visual);

    sim.step(1 / 30);
    view.apply(snapshotMatch(sim, 2));
    expect(view.visualBall).toBeUndefined();
    // WorkerMatchView adapts to snapshot intervals up to 250 ms. Allow that
    // complete interval even when a slower machine spends time in sim.step.
    view.renderTick(performance.now() + 300);
    expect(view.ball).toMatchObject(sim.ball);
  });

  it("keeps the visual pose object stable across sequential Rapier snapshots", () => {
    const { home, away, sim } = fixture();
    const view = new WorkerMatchView(home, away);
    view.apply(
      snapshotMatch(sim, 1, {
        x: 2,
        z: 1,
        height: 0.3,
        vx: 4,
        vy: 0.5,
        vz: -1,
        spin: 1,
      }),
    );
    const firstPose = view.visualBall;

    view.apply(
      snapshotMatch(sim, 2, {
        x: 4,
        z: -2,
        height: 0.75,
        vx: 6,
        vy: 1.2,
        vz: 0.4,
        spin: 2.5,
      }),
    );

    expect(view.visualBall).toBe(firstPose);
    expect(view.visualBall).toMatchObject({
      x: 2,
      z: 1,
      height: 0.3,
      vx: 6,
      vy: 1.2,
      vz: 0.4,
      spin: 2.5,
    });
    view.renderTick(performance.now() + 300);
    expect(view.visualBall).toMatchObject({ x: 4, z: -2, height: 0.75, vx: 6, vy: 1.2, spin: 2.5 });
    expect(view.visualBall?.vz).toBeCloseTo(0.4, 8);
  });
});
