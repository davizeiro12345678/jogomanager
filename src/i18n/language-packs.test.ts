import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDirectLocaleMessages, registerLanguagePack, translate } from "./messages";
import { ptBR } from "./bootstrap-messages";
import { pt } from "./interface-bootstrap";
import type { Lang } from "./locale-catalog";
import { LEGACY_PUBLISHED_LOCALES } from "./locale-runtime-manifest";

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
const dir = join(process.cwd(), "src", "i18n", "packs");
const keys = [...new Set([...Object.keys(ptBR), ...Object.keys(pt)])];

for (const lang of LEGACY_PUBLISHED_LOCALES) {
  registerLanguagePack(lang, JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8")));
}

describe("25 most-spoken languages", () => {
  it("translates every interface string instead of falling back to English", () => {
    for (const lang of TOP_25) {
      if (lang === "en") continue;
      const fallback = keys.filter((key) => translate(lang, key) === translate("en", key));
      // Brand names, numerals, and loanwords (Training, Scouting) can legitimately match English.
      expect(fallback.length, `${lang}: ${fallback.slice(0, 5).join(", ")}`).toBeLessThanOrEqual(
        20,
      );
    }
  });

  it("keeps placeholders intact in every pack", () => {
    const placeholders = (value: string) => (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort().join();
    for (const lang of TOP_25)
      for (const key of keys)
        expect(placeholders(translate(lang, key)), `${lang}:${key}`).toBe(
          placeholders(translate("en", key)),
        );
  });

  it("exposes direct locale messages without inventing fallback entries", () => {
    const direct = getDirectLocaleMessages("es");
    expect(direct["nav.panel"]).toBe("Panel");
    expect(direct["__missing_test_key__"]).toBeUndefined();
  });

  it("fails closed to English through the public translator for draft locales", () => {
    const draftLocale = "af" as Lang;
    expect(LEGACY_PUBLISHED_LOCALES).not.toContain(draftLocale);
    expect(translate(draftLocale, "nav.panel")).toBe(translate("en", "nav.panel"));
    expect(getDirectLocaleMessages(draftLocale)).toEqual({});
  });
});
