import { describe, expect, it } from "vitest";
import { isMatchRouteEntry } from "../../scripts/bundle-report-comparison.mjs";

describe("bundle comparison entry selection", () => {
  it("selects the hashed Match page rather than similarly named chunks", () => {
    expect(isMatchRouteEntry({ name: "match-AB_34-Cd.js" })).toBe(true);
    expect(isMatchRouteEntry({ name: "match-ai.functions-BrUxBJi8.js" })).toBe(false);
    expect(isMatchRouteEntry({ name: "match-command-validation-hash.js" })).toBe(false);
    expect(isMatchRouteEntry({ name: "match.worker-hash.js" })).toBe(false);
  });
});
