import { describe, expect, it } from "vitest";

import {
  DEFAULT_BROADCAST,
  migrateVisualSettings,
  normalizeBroadcastPreferences,
} from "./visual-settings";

describe("broadcast visual preferences", () => {
  it("keeps only stable camera IDs and caps cockpit favorites", () => {
    const preferences = normalizeBroadcastPreferences({
      camera: "director",
      directorAuto: true,
      replayCamera: "goal",
      favorites: ["director", "goal", "legacy", "skycam", "director", "fan"],
    });

    expect(preferences.camera).toBe("director");
    expect(preferences.directorAuto).toBe(true);
    expect(preferences.replayCamera).toBe("goal");
    expect(preferences.favorites).toEqual(["director", "goal", "skycam", "fan"]);
  });

  it("migrates v2 settings without invalidating old graphics choices", () => {
    const migrated = migrateVisualSettings({
      version: 2,
      quality: "alta",
      camera: "director",
      cameraFavorites: ["director", "tactical", "bad-id"],
      replayCamera: "inherit",
    });

    expect(migrated.quality).toBe("alta");
    expect(migrated.broadcast).toMatchObject({
      camera: "director",
      directorAuto: true,
      favorites: ["director", "tactical"],
      replayCamera: "inherit",
    });
  });

  it("falls back safely when storage is malformed", () => {
    expect(normalizeBroadcastPreferences(null)).toEqual(DEFAULT_BROADCAST);
    expect(
      normalizeBroadcastPreferences({ camera: "removed-camera", replayCamera: "stale", favorites: "stale" }),
    ).toEqual(DEFAULT_BROADCAST);
  });
});
