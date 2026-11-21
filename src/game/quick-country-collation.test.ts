import { afterEach, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LEAGUES } from "./data/leagues";
const state = vi.hoisted(() => ({ lang: "pt-BR" }));
vi.mock("@/i18n/provider", () => ({ useT: () => ({ lang: state.lang, t: (key: string) => key }) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) =>
    createElement("a", { href: to }, children),
}));
import { QuickMatchPage } from "../components/game/QuickMatchPage";
function countryLabels(markup: string): string[] {
  return [...markup.matchAll(/<optgroup\b[^>]*\blabel="([^"]*)"[^>]*>/g)].map((match) => match[1]!);
}
afterEach(() => vi.restoreAllMocks());
it.each(["pt-BR", "en", "es", "ar", "zh-CN"])(
  "renders every country in the original locale order without runtime collation (%s)",
  (lang) => {
    state.lang = lang;
    const expected = [...new Set(LEAGUES.map((league) => league.country))].sort((a, b) =>
      a === "Brasil" ? -1 : b === "Brasil" ? 1 : a.localeCompare(b, lang),
    );
    expect(expected).toHaveLength(102);
    // Encode expected labels through the same HTML serializer before observing
    // the real page render; country names may contain HTML-significant text.
    const expectedLabels = countryLabels(
      renderToStaticMarkup(
        createElement(
          "select",
          null,
          expected.map((country) => createElement("optgroup", { key: country, label: country })),
        ),
      ),
    );
    const legacy = vi.spyOn(String.prototype, "localeCompare"),
      collators = vi.spyOn(Intl, "Collator");
    const actualLabels = countryLabels(renderToStaticMarkup(createElement(QuickMatchPage)));
    expect(actualLabels).toHaveLength(102);
    expect(actualLabels).toEqual(expectedLabels);
    expect(legacy).not.toHaveBeenCalled();
    expect(collators).not.toHaveBeenCalled();
  },
);
