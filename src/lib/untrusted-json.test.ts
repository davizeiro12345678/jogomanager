import { describe, expect, it } from "vitest";
import { assertUntrustedJson, hasVisibleText, normalizePublicText } from "./untrusted-json";

describe("personal-save boundary", () => {
  it("accepts optional fields and precise development values without attesting them", () => {
    expect(() =>
      assertUntrustedJson({
        state: { players: { p1: { ovr: 69.12 } }, optional: undefined, fixtures: [], results: [] },
      }),
    ).not.toThrow();
  });
  it("rejects dangerous keys at arbitrary nesting", () => {
    for (const key of ["__proto__", "constructor", "prototype"]) {
      expect(() => assertUntrustedJson(JSON.parse(`{"state":{"nested":{"${key}":{}}}}`))).toThrow(
        /chave inválida/,
      );
    }
  });
  it("rejects cycles, nonfinite values and accessor properties without invoking getters", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(() => assertUntrustedJson(cyclic)).toThrow(/circular/);
    for (const value of [NaN, Infinity, -Infinity])
      expect(() => assertUntrustedJson({ budget: value })).toThrow(/número inválido/);
    const getter = Object.defineProperty({}, "value", {
      enumerable: true,
      get: () => {
        throw new Error("getter ran");
      },
    });
    expect(() => assertUntrustedJson(getter)).toThrow("Formato de carreira inválido.");
  });
  it("bounds breadth, depth and cumulative string size", () => {
    const limits = { nodes: 5, depth: 2, characters: 20 };
    expect(() => assertUntrustedJson([1, 2, 3, 4, 5], limits)).toThrow(/limite/);
    expect(() => assertUntrustedJson({ a: { b: { c: 1 } } }, limits)).toThrow(/limite/);
    expect(() => assertUntrustedJson("a".repeat(21), limits)).toThrow(/limite/);
  });
});

describe("international public text", () => {
  it("strips every forbidden display control while preserving internal text whitespace", () => {
    for (let code = 0; code < 32; code += 1) {
      const character = String.fromCharCode(code);
      const allowedWhitespace = code === 9 || code === 10 || code === 13;
      expect(normalizePublicText(`A${character}B`)).toBe(
        allowedWhitespace ? `A${character}B` : "AB",
      );
    }
    for (const code of [
      127, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
    ]) {
      expect(normalizePublicText(`A${String.fromCharCode(code)}B`)).toBe("AB");
    }
  });
  it("normalizes combining accents and strips impersonation controls", () => {
    expect(normalizePublicText("  Joa\u0303o\u202e\u0007  ")).toBe("João");
  });
  it("preserves Arabic, Indic scripts and joined emoji", () => {
    for (const text of ["مرحبا", "नमस्ते", "👨‍👩‍👧‍👦"]) {
      expect(normalizePublicText(text)).toBe(text);
      expect(hasVisibleText(text)).toBe(true);
    }
    expect(hasVisibleText("\u200b\u200d ")).toBe(false);
  });
});
