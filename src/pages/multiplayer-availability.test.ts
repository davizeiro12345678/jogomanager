import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClient: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) =>
    createElement("a", { href: to }, children),
}));

vi.mock("@/hooks/useAuthUserId", () => ({ useAuthUserId: () => null }));
vi.mock("@/i18n/provider", () => ({ useT: () => ({ lang: "pt-BR" }) }));
vi.mock("@/integrations/supabase/client", () => ({
  getConfiguredSupabaseClient: mocks.getClient,
  supabase: {},
}));

import { MultiplayerPage } from "./multiplayer";

describe("signed-out multiplayer availability", () => {
  it("offers a local match when sign-in is unavailable", () => {
    mocks.getClient.mockReturnValue(null);

    const markup = renderToStaticMarkup(createElement(MultiplayerPage));

    expect(markup).toContain("1×1 temporariamente indisponível");
    expect(markup).toContain("2×2 em validação");
    expect(markup).toContain('href="/partida-rapida"');
    expect(markup).not.toContain('href="/auth"');
  });

  it("keeps the 1×1 sign-in entry point in a configured environment", () => {
    mocks.getClient.mockReturnValue({});

    const markup = renderToStaticMarkup(createElement(MultiplayerPage));

    expect(markup).toContain("1×1 disponível");
    expect(markup).toContain('href="/auth"');
    expect(markup).not.toContain('href="/partida-rapida"');
  });
});
