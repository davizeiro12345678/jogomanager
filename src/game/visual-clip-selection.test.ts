import { expect, it } from "vitest";
import { selectPlayerClip } from "./visual-clip-selection";
import type { SelectCtx } from "./animation";

it("keeps reception height and a moving pass stable across an event and LOD handoff", () => {
  const view = {};
  const context: SelectCtx = {
    isGK: false,
    action: "trap",
    actionSeed: 12,
    actionDur: 1,
    actionT: 1,
    time: 20,
    speed: 0,
    ballHeight: 1.4,
    hasBall: true,
    ballDist: 0.3,
    stamina: 100,
    defending: false,
    stopped: true,
    seed: 8,
  };
  expect(selectPlayerClip(view, "p", context)).toBe("chestControlExit");
  expect(
    selectPlayerClip(view, "p", { ...context, ballHeight: 0.2, actionT: 0.1, time: 20.9 }),
  ).toBe("chestControlExit");
  expect(selectPlayerClip(view, "p", { ...context, actionSeed: 13, ballHeight: 0.7 })).toBe(
    "thighCushion",
  );
  expect(selectPlayerClip(view, "q", { ...context, action: "pass", speed: 4 })).toBe(
    "runningPassRecover",
  );
  expect(selectPlayerClip(view, "q", { ...context, action: "pass", speed: 0 })).toBe(
    "runningPassRecover",
  );
  selectPlayerClip(view, "q", { ...context, action: null });
  expect(selectPlayerClip(view, "q", { ...context, action: "pass", speed: 0 })).toBe("passShort");
});
