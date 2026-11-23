import { describe, expect, it } from "vitest";
import { evaluateMatchQuality, type MatchQualityTrend } from "./match-quality-autotune";

describe("automatic match graphics quality", () => {
  const fresh = (): MatchQualityTrend => ({ slow: 0, healthy: 0 });

  it("does not downgrade a 60-FPS match because of one bad 1% low", () => {
    const sample = { now: 60, avg: 60, low1: 17 };
    expect(evaluateMatchQuality("media", sample, fresh(), true).quality).toBe("media");
  });

  it("only lowers one quality tier after sustained poor gameplay FPS", () => {
    let state = fresh();
    let quality = "alta" as const;
    for (let i = 0; i < 3; i++) {
      const result = evaluateMatchQuality(quality, { now: 32, avg: 35 }, state, true);
      expect(result.quality).toBe("alta");
      state = result.trend;
    }
    expect(evaluateMatchQuality(quality, { now: 32, avg: 35 }, state, true).quality).toBe("media");
  });

  it("restores detail after sustained healthy FPS despite previous stutters", () => {
    let state = fresh();
    for (let i = 0; i < 7; i++) {
      const result = evaluateMatchQuality("baixa", { now: 60, avg: 58 }, state, true);
      expect(result.quality).toBe("baixa");
      state = result.trend;
    }
    expect(evaluateMatchQuality("baixa", { now: 60, avg: 58 }, state, true).quality).toBe(
      "media",
    );
  });

  it("ignores cinematics and pause time and resets the streak", () => {
    const state = { slow: 3, healthy: 7 };
    expect(
      evaluateMatchQuality("media", { now: 12, avg: 28 }, state, false),
    ).toEqual({ quality: "media", trend: fresh() });
  });
});
