import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { registerLanguagePack, translate } from "./messages";
import { ptBR } from "./bootstrap-messages";
import { pt } from "./interface-bootstrap";
import type { Lang } from "./locale-catalog";

const TOP_25: Lang[] = [
  "en",
  "es",
  "zh-CN",
  "hi",
  "ar",
  "fr",
  "bn",
  "ru",
  "pt-PT",
  "ur",
  "id",
  "de",
  "ja",
  "pa",
  "mr",
  "te",
  "tr",
  "ta",
  "vi",
  "ko",
  "it",
  "fa",
  "th",
  "pl",
  "sw",
] as Lang[];
const dir = join(__dirname, "packs");
const keys = [...new Set([...Object.keys(ptBR), ...Object.keys(pt)])];

describe("25 most-spoken languages", () => {
  for (const file of readdirSync(dir)) {
    const lang = file.replace(/\.json$/, "") as Lang;
    registerLanguagePack(lang, JSON.parse(readFileSync(join(dir, file), "utf8")));
  }
  it("translates every interface string instead of falling back to English", () => {
    for (const lang of TOP_25) {
      if (lang === "en") continue;
      const fallback = keys.filter((k) => translate(lang, k) === translate("en" as Lang, k));
      // Brand names and numerals can legitimately match English.
      expect(fallback.length, `${lang}: ${fallback.slice(0, 5).join(", ")}`).toBeLessThanOrEqual(
        12,
      );
    }
  });
  it("keeps placeholders intact in every pack", () => {
    const ph = (s: string) => (s.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join();
    for (const lang of TOP_25)
      for (const k of keys)
        expect(ph(translate(lang, k)), `${lang}:${k}`).toBe(ph(translate("en" as Lang, k)));
  });
});
