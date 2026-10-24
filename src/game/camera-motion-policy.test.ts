import { expect, it } from "vitest";
import { CAMERA_OPTIONS } from "./camera-modes";
import { accessibleMatchCamera } from "./camera-motion-policy";
it("preserves every normal camera and supplies a steady alternative to automatic cuts", () => {
  for (const { id } of CAMERA_OPTIONS) expect(accessibleMatchCamera(id, false)).toBe(id);
  for (const id of ["broadcast", "director", "cinematic"] as const)
    expect(accessibleMatchCamera(id, true)).toBe("tactical");
  for (const id of ["tactical", "goal", "rail", "sideline", "player"] as const)
    expect(accessibleMatchCamera(id, true)).toBe(id);
});
