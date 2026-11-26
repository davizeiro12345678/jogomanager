import { describe, expect, it } from "vitest";
import { shadowMapSizeFor } from "./shadow-map-budget";

describe("bounded stadium shadow quality under thermal pressure", () => {
  it("preserves high-quality 2048 maps on stable GPUs", () => {
    expect(shadowMapSizeFor("alta", 0)).toBe(2048);
    expect(shadowMapSizeFor("alta", 2)).toBe(2048);
    expect(shadowMapSizeFor("media", 0)).toBe(1024);
    expect(shadowMapSizeFor("baixa", 0)).toBe(512);
  });

  it("reduces GPU memory in tiers without jumping directly to 512", () => {
    expect(shadowMapSizeFor("alta", 3)).toBe(1024);
    expect(shadowMapSizeFor("alta", 5)).toBe(1024);
    expect(shadowMapSizeFor("alta", 6)).toBe(512);
    expect(shadowMapSizeFor("media", 4)).toBe(512);
  });

  it("fails closed on invalid pressure values", () => {
    for (const p of [NaN, Infinity, -1]) {
      expect(shadowMapSizeFor("alta", p)).toBe(512);
    }
  });
});
