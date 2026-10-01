import { describe, expect, it } from "vitest";
import { DEFAULT_VISUAL } from "./visual-settings";
import { activeGraphicsPreset, GRAPHICS_PRESETS, graphicsPresetPatch } from "./graphics-presets";

describe("graphics profile changes", () => {
  it("preserves club scenery and broadcast choices while switching every quality profile", () => {
    const original = {
      ...DEFAULT_VISUAL,
      weather: "chuva" as const,
      time: "noite" as const,
      byClub: { example: { grassTint: 0.4, mow: "diagonal" as const } },
      sponsors: ["example.com"],
      showFps: true,
      broadcast: { ...DEFAULT_VISUAL.broadcast, camera: "goal" as const },
    };
    for (const preset of GRAPHICS_PRESETS) {
      const changed = { ...original, ...graphicsPresetPatch(preset.id) };
      expect(activeGraphicsPreset(changed)).toBe(preset.id);
      expect(changed.byClub).toBe(original.byClub);
      expect(changed.broadcast).toBe(original.broadcast);
      expect(changed.sponsors).toBe(original.sponsors);
      expect(changed.weather).toBe("chuva");
      expect(changed.time).toBe("noite");
      expect(changed.showFps).toBe(true);
    }
  });

  it("identifies a manually edited profile as custom and leaves preset definitions immutable", () => {
    const patch = graphicsPresetPatch("broadcast");
    patch.resolutionScale = 0.72;
    expect(activeGraphicsPreset({ ...DEFAULT_VISUAL, ...patch })).toBeNull();
    expect(graphicsPresetPatch("broadcast").resolutionScale).toBe(1);
  });
});
