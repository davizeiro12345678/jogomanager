import { describe, expect, it } from "vitest";

import { PUBLIC_SEARCH_PAGES, responseIndexingPolicy } from "./public-indexing";

const HTML = "text/html; charset=utf-8";

describe("central public indexing policy", () => {
  it("leaves only the explicit public pages free of an X-Robots-Tag", () => {
    expect(new Set(PUBLIC_SEARCH_PAGES)).toHaveLength(PUBLIC_SEARCH_PAGES.length);
    for (const path of PUBLIC_SEARCH_PAGES) {
      expect(responseIndexingPolicy(path, HTML)).toBeNull();
    }
  });

  it("sets noindex for personal career, creation, purchase, match, social and editor screens", () => {
    for (const path of [
      "/carreira",
      "/new",
      "/jogador",
      "/jogador/novo",
      "/jogador/painel",
      "/clube/novo",
      "/loja",
      "/compras",
      "/checkout/return",
      "/match",
      "/pre-jogo",
      "/partida-rapida",
      "/chat",
      "/multiplayer",
      "/editor",
      "/visual",
    ]) {
      expect(responseIndexingPolicy(path, HTML)).toMatch(/^noindex,/);
    }
  });
});
