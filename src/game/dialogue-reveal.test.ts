import { describe, expect, it } from "vitest";
import { dialogueBoundaries, dialogueRevealLength } from "./dialogue-reveal";

describe("dialogue reveal", () => {
  it("never splits combining accents or joined emoji", () => {
    const text = "a\u0301\uD83D\uDC69\u200D\uD83D\uDCBB!";
    const boundaries = dialogueBoundaries(text);
    expect(boundaries).toEqual([2, 7, 8]);
    expect(text.slice(0, dialogueRevealLength(boundaries, 24))).toBe("a\u0301");
    expect(text.slice(0, dialogueRevealLength(boundaries, 48))).toBe(text.slice(0, 7));
    expect(dialogueRevealLength(boundaries, 1000)).toBe(text.length);
    expect(dialogueRevealLength(boundaries, -1)).toBe(0);
  });
  it("handles empty dialogue", () => {
    expect(dialogueRevealLength(dialogueBoundaries(""), 500)).toBe(0);
  });
});
