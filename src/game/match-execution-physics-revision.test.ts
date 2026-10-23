import { describe, expect, it } from "vitest";
import { buildTeamSetup } from "./quickMatch";
import { MatchSim } from "./sim";
import type { MatchCheckpoint } from "./sim-types";
import { createRapierBallAuthority } from "./rapier-ball-authority";

const create = () => new MatchSim(buildTeamSetup("fla"), buildTeamSetup("pal"), "physics-revision");

describe("physics revision recovery boundary", () => {
  it.each(["revision-2", "unversioned-rapier"])(
    "rejects %s snapshots without replacing the unfinished match or solver",
    async (kind) => {
      const source = create(),
        target = create();
      const sourceAuthority = await createRapierBallAuthority();
      const targetAuthority = await createRapierBallAuthority();
      source.setBallPhysicsAuthority(sourceAuthority);
      target.setBallPhysicsAuthority(targetAuthority);
      try {
        for (let tick = 0; tick < 20; tick++) source.step(1 / 30, 6);
        const checkpoint = source.checkpoint();
        const old =
          kind === "revision-2"
            ? { ...checkpoint, execution: { ...checkpoint.execution!, revision: 2 } }
            : { ...checkpoint, version: 1, execution: undefined };
        const untouched = target.checkpoint();
        expect(() => target.restoreCheckpoint(old as MatchCheckpoint, targetAuthority)).toThrow(
          /unsupported.*(?:checkpoint|execution)/i,
        );
        expect(target.checkpoint()).toEqual(untouched);
        expect(source.checkpoint()).toEqual(checkpoint);
      } finally {
        source.dispose();
        target.dispose();
      }
    },
  );
});
