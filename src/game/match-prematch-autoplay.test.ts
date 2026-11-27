import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("prematch cinematic to live kickoff", () => {
  it("automatically advances prematch lines to the referee's whistle", () => {
    const source = readFileSync(new URL("../pages/match.tsx", import.meta.url), "utf8");
    const scene = source.indexOf("scene={PREMATCH_SCENE_IDS[introStep]!}");
    expect(scene).toBeGreaterThan(-1);
    expect(source.slice(scene, scene + 450)).toMatch(/\bautoPlay\b/);
  });
});
