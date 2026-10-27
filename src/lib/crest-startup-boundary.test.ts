import { expect, it, vi } from "vitest";

vi.mock("@/game/data/leagues", () => {
  throw new Error("A crest supplied with a club must not initialize the league catalogue");
});
it("imports the real crest renderer without importing mutable campaign/catalogue code", async () => {
  const { Crest } = await import("../components/game/Crest");
  expect(typeof Crest).toBe("function");
});
