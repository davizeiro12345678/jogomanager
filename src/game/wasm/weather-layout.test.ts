import { describe, expect, it } from "vitest";
import { buildWeatherLayout, MAX_WEATHER_INSTANCES } from "./weather-layout";

describe("float32 weather layout", () => {
  it("bounds allocations before WASM integer coercion", () => {
    for (const count of [-1, NaN, Infinity, 1.5, MAX_WEATHER_INSTANCES + 1, 2 ** 32]) {
      expect(buildWeatherLayout(count, 42).length).toBe(0);
    }
  });
  it("produces repeatable packed GPU values in bounded ranges", () => {
    const values = buildWeatherLayout(2600, 42);
    expect(values).toBeInstanceOf(Float32Array);
    expect(values.length).toBe(13000);
    expect(values).toEqual(buildWeatherLayout(2600, 42));
    expect(values).not.toEqual(buildWeatherLayout(2600, 43));
    for (let i = 0; i < values.length; i += 5) {
      expect(Math.abs(values[i]!)).toBeLessThanOrEqual(78.5);
      expect(values[i + 1]!).toBeGreaterThanOrEqual(0);
      expect(values[i + 1]!).toBeLessThan(36);
      expect(Math.abs(values[i + 2]!)).toBeLessThanOrEqual(58);
      expect(values[i + 3]!).toBeGreaterThanOrEqual(Math.fround(0.6));
      expect(values[i + 3]!).toBeLessThanOrEqual(1.5);
    }
  });
});
