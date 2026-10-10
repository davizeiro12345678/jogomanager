import { describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { cinematicBusinessShot } from "./cinematic-business-shot";

describe("business insert framing", () => {
  it("frames the printed sheet above the desktop, across landscape and portrait", () => {
    for (const aspect of [16 / 9, 4 / 3, 390 / 844]) {
      const shot = cinematicBusinessShot(
        { kind: "transfer", stage: "signing", clubName: "Club", subjectName: "Player" },
        aspect,
      )!;
      expect(shot.position[1]).toBeGreaterThan(shot.target[1]);
      expect(shot.target).toEqual([0.86, 0.826, -1.18]);
      const distance = new Vector3(...shot.position).distanceTo(new Vector3(...shot.target));
      const width = 2 * distance * Math.tan((shot.fov * Math.PI) / 360) * aspect;
      // The 0.59m folio, rather than only the centre of its paper, must fit.
      expect(width).toBeGreaterThan(0.59);
    }
  });
  it("keeps ordinary scenes and tall meetings on their established compositions", () => {
    expect(cinematicBusinessShot(undefined, 16 / 9)).toBeNull();
    expect(
      cinematicBusinessShot(
        { kind: "sponsor", stage: "negotiation", clubName: "Club", subjectName: "Sponsor" },
        390 / 844,
      ),
    ).toBeNull();
  });
});
