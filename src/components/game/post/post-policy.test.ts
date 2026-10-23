import { it, expect } from "vitest";
import { postPath } from "./post-policy";
it("keeps low and medium profiles away from cinematic effects even during goals", () => {
  expect(postPath("baixa", "drama", true)).toBe("off");
  expect(postPath("media", "replay", true)).toBe("balanced");
  expect(postPath("alta", "match", false)).toBe("balanced");
  expect(postPath("alta", "drama", false)).toBe("cinema");
  expect(postPath("alta", "match", true)).toBe("cinema");
});
