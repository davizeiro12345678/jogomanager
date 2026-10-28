import { describe, expect, it } from "vitest";
import { supportersFromAiPlan } from "./match-ai-crowd";

describe("AI supporter plan", () => {
  it("converts the bounded model response into the existing crowd reaction contract", () => {
    expect(supportersFromAiPlan({ climate: "cobranca", intensity: 2 })).toEqual({
      side: "home",
      climate: "cobrança",
      intensity: 1,
      occupancy: 0.86,
    });
    expect(supportersFromAiPlan({ climate: "apoio", intensity: 0 }).intensity).toBe(0.25);
  });
});
