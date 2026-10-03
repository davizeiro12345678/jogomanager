import { expect, it } from "vitest";
import { LANGS } from "@/i18n/locale-catalog";
import { translate } from "@/i18n";
import { gamePageHead, gamePageMetadata, socialLocale } from "./game-page-metadata";

it("uses translated route identity for all supported languages without leaking query data", () => {
  for (const lang of LANGS) {
    const page = gamePageMetadata("/squad?save=personal-name#private", lang, (key) =>
      translate(lang, key),
    );
    expect(page?.title).toContain(translate(lang, "nav.squad"));
    expect(page?.title).not.toContain("personal-name");
    if (page?.locale) expect(page.locale).toMatch(/^[a-z]{2,3}_[A-Z]{2}$/);
  }
});
it("preserves explicit regions and leaves public editorial metadata intact", () => {
  expect(socialLocale("pt-PT")).toBe("pt_PT");
  expect(socialLocale("zh-TW")).toBe("zh_TW");
  expect(socialLocale("en")).toBe("en_US");
  expect(socialLocale("eo")).toBeNull();
  expect(gamePageMetadata("/", "en", (key) => key)).toBeNull();
  expect(gamePageMetadata("/unknown", "en", (key) => key)).toBeNull();
});
it("provides specific, private route metadata before hydration, with a clean canonical", () => {
  const league = gamePageHead("/league?save=private-player#result");
  expect(league.meta.find((m) => m["name"] === "description")?.["content"]).toContain(
    "rebaixamento",
  );
  expect(league.meta.find((m) => m["name"] === "robots")?.["content"]).toBe("noindex, follow");
  expect(league.links[0]?.href).toBe("https://jogomanager.com/league");
  expect(JSON.stringify(league)).not.toContain("private-player");
  expect(gamePageMetadata("/squad", "en", (key) => translate("en", key))?.description).toContain(
    "fitness",
  );
  expect(
    gamePageMetadata("/league", "pt-PT", (key) => translate("pt-PT", key))?.description,
  ).toContain("calendário");
});
