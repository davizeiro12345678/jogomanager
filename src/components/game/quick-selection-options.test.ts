import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { QuickMatchPage } from "./QuickMatchPage";
import {
  DEFAULT_QUICK_MATCH_LEAGUE,
  QUICK_MATCH_LEAGUE_DIRECTORY,
  type QuickMatchLeagueSummary,
} from "@/game/data/quick-match-catalog";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) =>
    createElement("a", { href: to }, children),
}));

it("preserves every SSR native option, order, selection and opposing-club exclusion", () => {
  const markup = renderToStaticMarkup(createElement(QuickMatchPage));
  const selects = [...markup.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)].map(
    (match) => match[1],
  );
  expect(selects).toHaveLength(3);

  const grouped = QUICK_MATCH_LEAGUE_DIRECTORY.reduce<Record<string, QuickMatchLeagueSummary[]>>(
    (groups, entry) => {
      (groups[entry.country] ??= []).push(entry);
      return groups;
    },
    {},
  );
  const compare = new Intl.Collator("pt-BR").compare;
  const originalLeagueOptions = Object.entries(grouped)
    .sort(([a], [b]) => (a === "Brasil" ? -1 : b === "Brasil" ? 1 : compare(a, b)))
    .map(([country, leagues]) =>
      createElement(
        "optgroup",
        { key: country, label: country },
        leagues.map((entry) =>
          createElement("option", { key: entry.id, value: entry.id }, entry.name),
        ),
      ),
    );
  const innerOptions = (html: string) => html.slice(html.indexOf(">") + 1, html.lastIndexOf("<"));
  const originalLeagueMarkup = renderToStaticMarkup(
    createElement("select", { defaultValue: DEFAULT_QUICK_MATCH_LEAGUE.id }, originalLeagueOptions),
  );
  expect(selects[0]).toBe(innerOptions(originalLeagueMarkup));

  const home = DEFAULT_QUICK_MATCH_LEAGUE.clubs[0]!;
  const away = DEFAULT_QUICK_MATCH_LEAGUE.clubs[1]!;
  for (const [index, selected, disabled] of [
    [1, home.id, away.id],
    [2, away.id, home.id],
  ] as const) {
    const originalClubMarkup = renderToStaticMarkup(
      createElement(
        "select",
        { defaultValue: selected },
        DEFAULT_QUICK_MATCH_LEAGUE.clubs.map((club) =>
          createElement(
            "option",
            { key: club.id, value: club.id, disabled: club.id === disabled },
            club.name,
          ),
        ),
      ),
    );
    expect(selects[index]).toBe(innerOptions(originalClubMarkup));
  }
  expect(markup.match(/<option\b/g)).toHaveLength(
    QUICK_MATCH_LEAGUE_DIRECTORY.length + 2 * DEFAULT_QUICK_MATCH_LEAGUE.clubs.length,
  );
});
