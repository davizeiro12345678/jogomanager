import { describe, expect, it } from "vitest";

import {
  GRAPHICS_BENCHMARK_VIEWPORT,
  resolveGraphicsBenchmark,
} from "../../scripts/graphics-benchmark-contract";

describe("graphics benchmark contract", () => {
  it("keeps the Flamengo x Palmeiras fixture and physical render target fixed", () => {
    const benchmark = resolveGraphicsBenchmark("");

    expect(benchmark.id).toBe("baseline");
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
});
