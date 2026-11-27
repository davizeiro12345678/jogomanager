import { readFileSync } from "node:fs";
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
    const quality = "alta" as const;
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
    expect(evaluateMatchQuality("baixa", { now: 60, avg: 58 }, state, true).quality).toBe("media");
  });

  it("ignores cinematics and pause time and resets the streak", () => {
    const state = { slow: 3, healthy: 7 };
    expect(evaluateMatchQuality("media", { now: 12, avg: 28 }, state, false)).toEqual({
      quality: "media",
      trend: fresh(),
    });
  });
  it("clears the auto-quality trend on tab visibility changes", () => {
    const source = readFileSync(new URL("../pages/match.tsx", import.meta.url), "utf8");
    const handlerStart = source.indexOf("const onVisibility = () =>");
    expect(handlerStart).toBeGreaterThan(-1);
    const handler = source.slice(handlerStart, handlerStart + 420);
    expect(handler).toMatch(/qualityTrendRef\.current\s*=\s*\{\s*slow:\s*0,\s*healthy:\s*0\s*\}/);
    expect(handler).toMatch(/document\.hidden/);
  });

});
