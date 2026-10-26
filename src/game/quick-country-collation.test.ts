import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { LEAGUES } from "./data/leagues";
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
it.each(["pt-BR", "en", "es", "ar", "zh-CN"])(
  "preserves country order with one collator rather than ICU setup per comparison (%s)",
  (lang) => {
    state.lang = lang;
    const expected = [...new Set(LEAGUES.map((league) => league.country))].sort((a, b) =>
      a === "Brasil" ? -1 : b === "Brasil" ? 1 : a.localeCompare(b, lang),
    );
    const legacy = vi.spyOn(String.prototype, "localeCompare"),
      collators = vi.spyOn(Intl, "Collator");
    expect(countries(QuickMatchPage())).toEqual(expected);
    expect(legacy).not.toHaveBeenCalled();
    expect(collators).toHaveBeenCalledTimes(1);
  },
);
