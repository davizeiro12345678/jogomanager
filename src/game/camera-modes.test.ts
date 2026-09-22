import { describe, expect, it } from "vitest";

import { CAMERA_OPTIONS, cameraOption, nextCameraMode, type CameraMode } from "./camera-modes";

describe("camera mode catalog", () => {
  it("keeps the new director, sideline and skycam modes discoverable", () => {
    const ids = CAMERA_OPTIONS.map((option) => option.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["director", "sideline", "skycam"]));
    expect(cameraOption("director").label).toBe("Diretor");
    expect(cameraOption("sideline").description).toContain("área técnica");
  });

  it("cycles every available mode and returns to the opening broadcast camera", () => {
    let current: CameraMode = CAMERA_OPTIONS[0]!.id;
    for (let index = 0; index < CAMERA_OPTIONS.length; index++) current = nextCameraMode(current);

    expect(current).toBe("broadcast");
  });
});
