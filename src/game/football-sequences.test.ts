import { describe, expect, it } from "vitest";
import { FOOTBALL_SEQUENCE_CLIPS, SEQUENCE_LIBRARY } from "./football-sequences";
import { getClip, selectClip, type SelectCtx } from "./animation";
import { clampPoseAnatomy } from "./ground-contact";
import { JOINTS } from "./animation-core";
import { getAnnotatedClip } from "./register-animations";

const context: SelectCtx = {
  isGK: false,
  action: "trap",
  speed: 0,
  hasBall: true,
  ballDist: 0.4,
  stamina: 100,
  defending: false,
  stopped: true,
  seed: 41,
  time: 20,
  actionSeed: 731,
};
describe("complete football sequences", () => {
  it("authors twelve distinct multi-stage movements with finite, anatomically safe output at 15–120 FPS", () => {
    const fingerprints = new Set<string>();
    for (const [id] of SEQUENCE_LIBRARY) {
      const clip = FOOTBALL_SEQUENCE_CLIPS[id];
      expect(getClip(id)).toBe(clip);
      const samples = [];
      for (const fps of [15, 30, 60, 120])
        for (let frame = 0; frame <= fps; frame++) {
          const pose = clip({
            u: frame / fps,
            t: (frame / fps) * 1.4,
            speed: 3,
            stride: 0.4,
            seed: 41,
          });
          expect(JOINTS.every((j) => Number.isFinite(pose[j]))).toBe(true);
          clampPoseAnatomy(pose);
          expect(Object.values(pose).every(Number.isFinite)).toBe(true);
          if (fps === 30 && frame % 5 === 0) samples.push(JOINTS.map((j) => pose[j].toFixed(3)));
        }
      fingerprints.add(JSON.stringify(samples));
    }
    expect(fingerprints.size).toBe(12);
  });
  it("selects a reachable reception height and a moving pass without changing the event context", () => {
    const before = { ...context };
    expect(selectClip({ ...context, ballHeight: 1.4 })).toBe("chestControlExit");
    expect(selectClip({ ...context, ballHeight: 0.7 })).toBe("thighCushion");
    expect(selectClip({ ...context, action: "pass", speed: 4 })).toBe("runningPassRecover");
    expect(selectClip({ ...context, action: "pass", speed: 0 })).toBe("passShort");
    expect(context).toEqual(before);
  });
  it("holds a variant for the complete event and registers one-shot sequence metadata", () => {
    const name = selectClip({ ...context, action: "save", isGK: true });
    for (const actionT of [0.9, 0.6, 0.3, 0.01])
      expect(selectClip({ ...context, action: "save", isGK: true, actionT, actionDur: 1 })).toBe(
        name,
      );
    for (const [id] of SEQUENCE_LIBRARY) {
      const annotated = getAnnotatedClip(id);
      expect(annotated?.metadata.loop).toBe(false);
      expect(annotated?.metadata.tags).toContain("football-sequence");
    }
  });
});
