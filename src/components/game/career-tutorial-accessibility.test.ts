import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tutorialCss = readFileSync(new URL("./career-tutorial.css", import.meta.url), "utf8");

describe("career tutorial keyboard focus", () => {
  it("keeps the pending-filter checkbox visibly focusable", () => {
    expect(tutorialCss).toMatch(/\.career-guide :is\(a, button, input, summary\):focus-visible/);
    expect(tutorialCss).toMatch(
      /@media\s*\(forced-colors:\s*active\)[\s\S]*\.career-guide :is\(a, button, input, summary\):focus-visible[\s\S]*outline-color:\s*Highlight/,
    );
  });
});
