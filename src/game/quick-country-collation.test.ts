import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { LEAGUES } from "./data/leagues";
import { LANGS } from "../i18n/locale-identifiers";
import { COUNTRY_COLLATION_EXCEPTIONS } from "./quick-country-order.generated";
const state = vi.hoisted(() => ({ lang: "pt-BR" }));
vi.mock("@/i18n/provider", () => ({ useT: () => ({ lang: state.lang, t: (key: string) => key }) }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: <T>(initial: T | (() => T)) => [
    typeof initial === "function" ? (initial as () => T)() : initial,
    () => undefined,
  ],
}));
import { QuickMatchPage } from "../components/game/QuickMatchPage";
function countries(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(countries);
  if (!isValidElement<{ children?: unknown; label?: string }>(node)) return [];
  if (node.type === "optgroup") return [node.props.label!];
  return countries((node as ReactElement<{ children?: unknown }>).props.children);
}
afterEach(() => vi.restoreAllMocks());
it.each(LANGS)(
  "preserves country order without cold ICU setup for common collation (%s)",
  (lang) => {
    state.lang = lang;
    const expected = [...new Set(LEAGUES.map((league) => league.country))].sort((a, b) =>
      a === "Brasil" ? -1 : b === "Brasil" ? 1 : a.localeCompare(b, lang),
    );
    const legacy = vi.spyOn(String.prototype, "localeCompare"),
      collators = vi.spyOn(Intl, "Collator");
    expect(countries(QuickMatchPage())).toEqual(expected);
    expect(legacy).not.toHaveBeenCalled();
    expect(collators).toHaveBeenCalledTimes(COUNTRY_COLLATION_EXCEPTIONS.has(lang) ? 1 : 0);
  },
);

it("uses platform collation when a custom country is added to the mutable catalogue", () => {
  state.lang = "en";
  LEAGUES.push({ ...LEAGUES[0]!, id: "custom-country", country: "Åland" });
  try {
    const expected = [...new Set(LEAGUES.map((l) => l.country))].sort((a, b) =>
      a === "Brasil" ? -1 : b === "Brasil" ? 1 : a.localeCompare(b, state.lang),
    );
    const collators = vi.spyOn(Intl, "Collator");
    expect(countries(QuickMatchPage())).toEqual(expected);
    expect(collators).toHaveBeenCalledTimes(1);
  } finally {
    LEAGUES.pop();
  }
});
