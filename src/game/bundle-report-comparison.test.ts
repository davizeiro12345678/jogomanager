import { describe, expect, it } from "vitest";
import { isMatchRouteEntry } from "../../scripts/bundle-report-comparison.mjs";

describe("bundle comparison entry selection", () => {
  it("selects the Match page rather than command-validation chunks", () => {
    expect(isMatchRouteEntry({ name: "match-route.js" })).toBe(true);
    expect(isMatchRouteEntry({ name: "match-command-validation-hash.js" })).toBe(false);
    expect(isMatchRouteEntry({ name: "match.worker-hash.js" })).toBe(false);
  });
});
