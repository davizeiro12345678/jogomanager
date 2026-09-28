import { describe, expect, it } from "vitest";

import {
  lineCount,
  narrationLine,
  narrationLang,
  type NarrationEvent,
  type NarrationLang,
} from "./narration-lines";

const events: NarrationEvent[] = [
  "goal",
  "save",
  "shot",
  "post",
  "foul",
  "card",
  "redCard",
  "chance",
  "corner",
  "sub",
  "kickoff",
  "halftime",
  "fulltime",
];

describe("narration catalogue", () => {
  it.each<[NarrationLang, number]>([
    ["pt", 300],
    ["en", 200],
    ["es", 200],
  ])("keeps the expanded %s catalogue above its minimum", (lang, minimum) => {
    const total = events.reduce((sum, event) => sum + lineCount(lang, event), 0);
    expect(total).toBeGreaterThanOrEqual(minimum);
  });

  it("replaces team placeholders without exposing raw templates", () => {
    for (const lang of ["pt", "en", "es"] as const) {
      for (const event of events) {
        const line = narrationLine(lang, event, "Aurora FC", 999);
        expect(line).not.toContain("{team}");
        expect(line.length).toBeGreaterThan(5);
      }
    }
  });

  it("normalizes supported browser languages and falls back to English", () => {
    expect(narrationLang("pt-BR")).toBe("pt");
    expect(narrationLang("es-MX")).toBe("es");
    expect(narrationLang("fr-FR")).toBe("en");
  });
});
