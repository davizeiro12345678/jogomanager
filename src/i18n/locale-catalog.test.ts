import { describe, expect, it } from "vitest";
import {
  ADDED_LANGS,
  BASE_LANGS,
  LANGS,
  LANG_NAMES,
  RTL_LANGS,
  languageSearchText,
  resolveLang,
} from "./locale-catalog";
import { CORE_NAV_KEYS, EXPANDED_MESSAGES } from "./expanded-messages";
import { MATCH_EVENT_KEYS, MATCH_EVENT_MESSAGES } from "./match-event-messages";
import { translate } from "./index";
import { narrationLang, narrationLine, supportsRemoteNarration } from "@/game/narration-lines";

describe("98-language product catalogue", () => {
  it("adds exactly 59 distinct languages while preserving all 39 existing identifiers", () => {
    expect(BASE_LANGS).toHaveLength(39);
    expect(ADDED_LANGS).toHaveLength(59);
    expect(LANGS).toHaveLength(98);
    expect(new Set(LANGS).size).toBe(98);
    expect(BASE_LANGS.every((lang) => LANGS.includes(lang))).toBe(true);
    for (const lang of LANGS) {
      expect(LANG_NAMES[lang].length).toBeGreaterThan(1);
      expect(() => new Intl.Locale(lang)).not.toThrow();
    }
  });
  it("provides real core messages and every match event for each added language", () => {
    for (const lang of ADDED_LANGS)
      for (const key of CORE_NAV_KEYS) {
        expect(EXPANDED_MESSAGES[lang][key], `${lang}: ${key}`).toBeTruthy();
        expect(translate(lang, key)).not.toBe(key);
      }
    for (const lang of LANGS)
      for (const event of MATCH_EVENT_KEYS) {
        expect(MATCH_EVENT_MESSAGES[lang][event], `${lang}: ${event}`).toBeTruthy();
        const text = narrationLine(narrationLang(lang), event, "Aurora FC", 1, {
          minute: 88,
          homeGoals: 2,
          awayGoals: 1,
          player: "Léo",
          importance: "decisive",
        });
        expect(text.length).toBeGreaterThan(6);
        expect(text).not.toContain("undefined");
        expect(text).not.toContain("{team}");
      }
  });
  it("resolves region and script aliases without discarding Chinese variants or new locales", () => {
    expect(resolveLang("PT_pt")).toBe("pt-PT");
    expect(resolveLang("pt")).toBe("pt-BR");
    expect(resolveLang("zh-Hant-HK")).toBe("zh-TW");
    expect(resolveLang("zh-Hans-SG")).toBe("zh-CN");
    expect(resolveLang("ur-PK")).toBe("ur");
    expect(resolveLang("fil-PH")).toBe("fil");
    expect(resolveLang("tl-PH")).toBe("fil");
    expect(resolveLang("nb-NO")).toBe("no");
    expect(resolveLang("not-a-language")).toBeUndefined();
  });
  it("searches native names, translated names and codes, and marks the nine RTL locales", () => {
    expect(languageSearchText("ur", "pt-BR")).toContain("urdu");
    expect(languageSearchText("ur", "pt-BR")).toContain("اردو");
    expect(languageSearchText("gl", "pt-BR")).toContain("gl");
    expect(RTL_LANGS.size).toBe(9);
    expect(RTL_LANGS.has("ur")).toBe(true);
    expect(RTL_LANGS.has("ku")).toBe(false);
  });
  it("keeps unsupported remote voice languages out of the authenticated voice endpoint", () => {
    expect(supportsRemoteNarration(narrationLang("pt-BR"))).toBe(true);
    for (const lang of ADDED_LANGS)
      expect(supportsRemoteNarration(narrationLang(lang))).toBe(false);
    expect(translate("en", "nav.coach")).toBe("Manager career");
  });
});
