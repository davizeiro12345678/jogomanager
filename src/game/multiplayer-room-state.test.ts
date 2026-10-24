import { describe, expect, it } from "vitest";
import { shouldShowLiveRoom } from "./multiplayer-room-state";

describe("multiplayer presentation lifecycle", () => {
  it("keeps the stadium mounted while confirming and displaying the official result", () => {
    for (const status of ["live", "settling", "done"]) {
      expect(shouldShowLiveRoom({ status, state: { hg: 2, ag: 1 } })).toBe(true);
    }
  });
  it("returns abandoned and waiting rooms to the lobby", () => {
    for (const status of ["open", "ready", "done"]) {
      expect(shouldShowLiveRoom({ status, state: {} })).toBe(false);
    }
    for (const hg of [-1, 0.5, "2", NaN, Infinity]) {
      expect(shouldShowLiveRoom({ status: "done", state: { hg, ag: 0 } })).toBe(false);
    }
  });
});
