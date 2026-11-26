import { describe, expect, it } from "vitest";
import * as graphics from "../../scripts/graphics-benchmark-contract";

import {
  GRAPHICS_BENCHMARK_VIEWPORT,
  resolveGraphicsBenchmark,
} from "../../scripts/graphics-benchmark-contract";

describe("graphics benchmark contract", () => {
  it("preserves legacy scene JSON while exporting revised metadata explicitly", () => {
    expect(typeof graphics.graphicsBenchmarkSceneMetadata).toBe("function");
    const legacy = graphics.graphicsBenchmarkSceneMetadata(
      resolveGraphicsBenchmark(""),
      "tactical",
    );
    expect(Object.keys(legacy)).toEqual([
      "id",
      "label",
      "seed",
      "quality",
      "presetCamera",
      "camera",
      "time",
      "weather",
      "mow",
      "fixture",
      "viewport",
      "requested",
    ]);
    expect(Object.keys(legacy.requested)).toEqual(["scenario", "seed", "quality", "camera"]);
    const revised = graphics.graphicsBenchmarkSceneMetadata(
      resolveGraphicsBenchmark("?scenario=rules2"),
      "broadcast",
    );
    expect(revised).toHaveProperty("rulesRevision", 2);
    expect(revised.requested).toHaveProperty("rulesRevision", null);
  });
  it("keeps the Flamengo x Palmeiras fixture and physical render target fixed", () => {
    const benchmark = resolveGraphicsBenchmark("");

    expect(benchmark.id).toBe("baseline");
    expect(benchmark.rulesRevision).toBe(1);
    expect(benchmark.fixture).toEqual({
      homeClubId: "fla",
      awayClubId: "pal",
      label: "Flamengo x Palmeiras",
    });
    expect(benchmark.viewport).toEqual(GRAPHICS_BENCHMARK_VIEWPORT);
    expect(benchmark.viewport).toEqual({ width: 1280, height: 720, dpr: 1 });
  });

  it("allows only the visual scenario controls to be overridden", () => {
    const benchmark = resolveGraphicsBenchmark(
      "?scenario=director&seed=night-match-42&quality=cinema&camera=cinematic&time=noite&weather=chuva&mow=checker",
    );

    expect(benchmark).toMatchObject({
      id: "director",
      seed: "night-match-42",
      quality: "cinema",
      presetCamera: "director",
      camera: "cinematic",
      time: "noite",
      weather: "chuva",
      mow: "checker",
      fixture: {
        homeClubId: "fla",
        awayClubId: "pal",
      },
      viewport: GRAPHICS_BENCHMARK_VIEWPORT,
    });
  });

  it.each(["toString", "__proto__"])(
    "falls back to baseline for inherited scenario id %s",
    (scenario) => {
      const benchmark = resolveGraphicsBenchmark(`?scenario=${scenario}`);

      expect(benchmark.id).toBe("baseline");
      expect(benchmark.requested.scenario).toBe(scenario);
    },
  );

  it("bounds custom seeds without losing deterministic benchmark metadata", () => {
    const seed = "s".repeat(120);
    const benchmark = resolveGraphicsBenchmark(`?seed=${seed}`);

    expect(benchmark.seed).toBe(seed.slice(0, 96));
    expect(benchmark.seed).toHaveLength(96);
    expect(benchmark.requested.seed).toBe(seed);
  });

  it("adds an explicit revised-rules campaign without changing the legacy baseline", () => {
    const old = resolveGraphicsBenchmark("");
    const revised = resolveGraphicsBenchmark("?scenario=rules2");
    expect(old).toMatchObject({
      id: "baseline",
      seed: "graphics-high-v1",
      camera: "tactical",
      rulesRevision: 1,
    });
    expect(revised).toMatchObject({
      id: "rules2",
      seed: "graphics-broadcast-v1",
      camera: "broadcast",
      quality: "alta",
      rulesRevision: 2,
      fixture: old.fixture,
      viewport: old.viewport,
    });
    expect(resolveGraphicsBenchmark("?rulesRevision=2").rulesRevision).toBe(2);
    expect(resolveGraphicsBenchmark("?rulesRevision=1").rulesRevision).toBe(1);
  });

  it.each(["", "0", "3", "02", "null", "2.0", "2&rulesRevision=1"])(
    "rejects ambiguous or unsupported query rule revision %s",
    (value) =>
      expect(() => resolveGraphicsBenchmark(`?rulesRevision=${value}`)).toThrow(/rules revision/i),
  );
});
