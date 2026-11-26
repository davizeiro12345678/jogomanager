import { describe, expect, it } from "vitest";
import { matchLighting } from "./match-lighting";

describe("weather motivated match lighting", () => {
  it("replaces direct daylight with diffuse sky fill in rain without changing night floodlights", () => {
    const dry = matchLighting("dia", "seco", false),
      rain = matchLighting("dia", "chuva", false);
    expect(rain.keyIntensity).toBeLessThan(dry.keyIntensity);
    expect(rain.fillIntensity).toBeGreaterThan(dry.fillIntensity);
    expect(rain.hemiIntensity).toBeGreaterThan(dry.hemiIntensity);
    expect(rain.fogFar).toBeLessThan(dry.fogFar);
    expect(matchLighting("noite", "chuva", false).keyIntensity).toBe(
      matchLighting("noite", "seco", false).keyIntensity,
    );
  });
  it("keeps a damp sunny pitch distinct from active rain and retains low quality fill", () => {
    expect(matchLighting("dia", "molhado", false)).toEqual(matchLighting("dia", "seco", false));
    expect(matchLighting("dia", "chuva", true).hemiIntensity).toBeGreaterThan(
      matchLighting("dia", "chuva", false).hemiIntensity,
    );
    expect(matchLighting("entardecer", "seco", false).keyPosition[1]).toBeLessThan(
      matchLighting("dia", "seco", false).keyPosition[1],
    );
  });
});

it("preserves floodlight strength at night while separating storm fill and wet reflection", () => {
  const dry = matchLighting("noite", "seco", false);
  const rain = matchLighting("noite", "chuva", false);
  expect(rain.keyIntensity).toBe(dry.keyIntensity);
  expect(rain.fillIntensity).toBeGreaterThan(dry.fillIntensity);
  expect(rain.hemiIntensity).toBeGreaterThan(dry.hemiIntensity);
  expect(rain.environmentKey).toBeGreaterThan(dry.environmentKey);
  expect(rain.fogFar).toBeLessThan(dry.fogFar);
});

it("uses a cooler reflected ground fill in snow without adding light sources", () => {
  for (const time of ["dia", "noite", "entardecer"] as const) {
    const rain = matchLighting(time, "chuva", false);
    const snow = matchLighting(time, "neve", false);
    expect(snow.groundColor).not.toBe(rain.groundColor);
    expect(snow.keyIntensity).toBe(rain.keyIntensity);
    expect(snow.keyPosition).toEqual(rain.keyPosition);
    expect(snow.fogFar).toBeLessThan(rain.fogFar);
  }
});
