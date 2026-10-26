import { describe, expect, it } from "vitest";
import summary from "./catalog-summary.generated.json";
import { SHIPPED_CATALOG } from "./catalog-facts";

describe("public catalogue summary", () => {
  it("publishes the same populations as the shipped catalogue without importing it into public pages", () => {
    expect(summary).toEqual(SHIPPED_CATALOG);
    expect(summary.memberships).toBeGreaterThanOrEqual(summary.playableClubs);
  });
});
