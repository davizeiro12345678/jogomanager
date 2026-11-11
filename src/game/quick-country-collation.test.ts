import { afterEach, expect, it, vi } from "vitest";
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
afterEach(() => vi.restoreAllMocks());

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
  useRef: <T>(initial: T) => ({ current: initial }),
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
  useRef: <T>(initial: T) => ({ current: initial }),
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
  "renders every country in the original locale order without runtime collation (%s)",
  (lang) => {
  (lang) => {
    const expected = [
      ...new Set(QUICK_MATCH_LEAGUE_DIRECTORY.map((league) => league.country)),
    ].sort((left, right) =>
      left === "Brasil" ? -1 : right === "Brasil" ? 1 : left.localeCompare(right, lang),
    );
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
  useRef: <T>(initial: T) => ({ current: initial }),
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
  useRef: <T>(initial: T) => ({ current: initial }),
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
    const actualLabels = countryLabels(renderToStaticMarkup(createElement(QuickMatchPage)));
    expect(actualLabels).toHaveLength(102);
    expect(actualLabels).toEqual(expectedLabels);
    expect(legacy).not.toHaveBeenCalled();
    expect(legacy).not.toHaveBeenCalled();
    expect(collators).not.toHaveBeenCalled();
  },
);

  },
);

it("keeps all league identities and in-country order without mutating the source", () => {
  const leagues = Object.freeze([
    Object.freeze({ id: "es", country: "Espanha" }),
    Object.freeze({ id: "br-a", country: "Brasil" }),
    Object.freeze({ id: "pt", country: "Portugal" }),
    Object.freeze({ id: "br-b", country: "Brasil" }),
  ]);
  const result = groupQuickMatchLeagues(leagues, "pt-BR");
  expect(result.map(([country]) => country)).toEqual(["Brasil", "Espanha", "Portugal"]);
  const brazil = result[0]![1];
  expect(brazil).toEqual([leagues[1], leagues[3]]);
  expect(brazil[0]).toBe(leagues[1]);
  expect(brazil[1]).toBe(leagues[3]);
  expect(leagues.map((league) => league.id)).toEqual(["es", "br-a", "pt", "br-b"]);
});

it("accepts country labels that coincide with object-prototype property names", () => {
  const leagues = [
    { id: "proto", country: "__proto__" },
    { id: "constructor", country: "constructor" },
    { id: "br", country: "Brasil" },
  ];
  const result = new Map(groupQuickMatchLeagues(leagues, "en"));
  expect(result.get("__proto__")).toEqual([leagues[0]]);
  expect(result.get("constructor")).toEqual([leagues[1]]);
  expect(result.get("Brasil")).toEqual([leagues[2]]);
  expect(groupQuickMatchLeagues([], "pt-BR")).toEqual([]);
});

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
  useRef: <T>(initial: T) => ({ current: initial }),
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
