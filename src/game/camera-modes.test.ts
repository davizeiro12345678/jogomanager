import { describe, expect, it } from "vitest";

import {
  CAMERA_CYCLE,
  CAMERA_OPTIONS,
  SHOT_SPECS,
  cameraOption,
  camerasForCategory,
  isCameraMode,
  nextCameraMode,
  shotSpec,
  type CameraMode,
} from "./camera-modes";

describe("camera mode catalog", () => {
  it("keeps the new director, sideline and skycam modes discoverable", () => {
    const ids = CAMERA_OPTIONS.map((option) => option.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["director", "sideline", "skycam"]));
    expect(cameraOption("director").label).toBe("Diretor");
    expect(cameraOption("sideline").description).toContain("área técnica");
  });

  it("cycles every available mode and returns to the opening broadcast camera", () => {
    let current: CameraMode = CAMERA_CYCLE[0]!;
    for (let index = 0; index < CAMERA_CYCLE.length; index++) current = nextCameraMode(current);

    expect(current).toBe("broadcast");
    expect(nextCameraMode("cinematic")).toBe("skycam");
  });

  it("exposes grouped controls and director-safe shot specifications", () => {
    expect(camerasForCategory("cinema").map((option) => option.id)).toEqual(
      expect.arrayContaining(["cinematic", "rail", "player", "goal"]),
    );
    expect(SHOT_SPECS.every((spec) => spec.minimumHoldMs >= 2000)).toBe(true);
    expect(shotSpec("return-tv").fallbackCamera).toBe("broadcast");
    expect(isCameraMode("director")).toBe(true);
    expect(isCameraMode("legacy-cam")).toBe(false);
  });
});
