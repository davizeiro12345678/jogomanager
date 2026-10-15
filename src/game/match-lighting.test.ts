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
