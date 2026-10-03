import { describe, expect, it } from "vitest";
import { DEFAULT_ACCESSIBILITY, parseAccessibility } from "./accessibility-preferences";
describe("persistent accessibility preferences", () => {
  it("restores defaults from missing, legacy or corrupt storage", () => {
    for (const value of [
      null,
      undefined,
      "bad JSON",
      false,
      { textSize: "tiny", motion: "always", rate: NaN, volume: Infinity },
    ])
      expect(parseAccessibility(value)).toEqual(DEFAULT_ACCESSIBILITY);
  });
  it("preserves valid independent reading and narration settings through serialization", () => {
    const original = parseAccessibility({
      textSize: "xlarge",
      contrast: "high",
      motion: "reduced",
      readingSpace: true,
      narration: "captions",
      captions: false,
      rate: 1.2,
      volume: 0.45,
      voiceURI: "voice-ur",
      realistic: false,
    });
    expect(parseAccessibility(JSON.parse(JSON.stringify(original)))).toEqual(original);
    expect(original.narration).toBe("captions");
    expect(original.readingSpace).toBe(true);
  });
  it("clamps malformed numeric preferences and bounds voice identifiers", () => {
    const values = parseAccessibility({ volume: -99, rate: 999, voiceURI: "v".repeat(1000) });
    expect(values.volume).toBe(0);
    expect(values.rate).toBe(1.5);
    expect(values.voiceURI).toHaveLength(256);
  });
});
