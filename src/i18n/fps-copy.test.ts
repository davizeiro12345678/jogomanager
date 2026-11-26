import { describe, expect, it } from "vitest";
import { fpsCopy } from "./fps-copy";
import { fpsReport } from "@/game/fps-meter";

describe("FPS diagnostics language", () => {
  it.each(["pt-BR", "pt-PT"] as const)("provides Portuguese UI and report copy for %s", (lang) => {
    const copy = fpsCopy(lang);
    expect(copy.locale).toBe("pt");
    expect(copy.copyResult).toBe("Copiar resultado");
    expect(copy.renderedWindow(6, "alta")).toBe("6s de quadros do estádio · alta");
    expect(copy.suspended).toBe("Medição suspensa fora da partida ativa.");
  });

  it("switches the same measurement controls to English", () => {
    const copy = fpsCopy("en");
    expect(copy.locale).toBe("en");
    expect(copy.copyResult).toBe("Copy result");
    expect(copy.renderedWindow(6, "alta")).toBe("6s of stadium render frames · alta");
    expect(copy.suspended).toBe("Measurement paused outside the active match.");
    expect(copy.rafWindow(2)).toBe("2s of browser pacing (RAF)");
  });

  it.each(["es", "fr", "de", "ja", "ar"] as const)(
    "uses an explicit English fallback for %s without claiming a translation",
    (lang) => {
      expect(fpsCopy(lang)).toBe(fpsCopy("en"));
      expect(fpsCopy(lang).locale).toBe("en");
    },
  );

  it("localizes copied diagnostics without changing canonical scenario identifiers", () => {
    const sample = {
      now: 60,
      avg: 60,
      worst: 55,
      low1: 50,
      seconds: 6,
      source: "rendered" as const,
      phase: "match",
      quality: "alta",
      camera: "tactical",
      measurementKey: "same-seed-and-fixture",
    };
    const english = fpsReport(sample, {}, "en");
    expect(english).toContain("Average FPS: 60");
    expect(english).toContain("Measured preset: alta");
    expect(english).toContain("Measured phase: match");
    expect(english).toContain("Measured camera: tactical");
    expect(english).toContain("Measured scenario: same-seed-and-fixture");
    expect(english).toContain("Source: post-render stadium frames");
    expect(english).not.toContain("Fase medida");
    expect(fpsReport(sample, {}, "fr")).toBe(english);
    expect(fpsReport(sample, {}, "pt-BR")).toContain("Fase medida: match");
  });
});
