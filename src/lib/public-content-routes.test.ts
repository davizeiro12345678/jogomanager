import { describe, expect, it } from "vitest";
import {
  isLightweightCssPath,
  isPublicContentPath,
  shouldPreloadArticleHeadingFont,
  shouldInitializeWorldOnEntry,
} from "./public-content-routes";

describe("public content isolation", () => {
  it("defers the new-career world while preserving existing career startup", () => {
    expect(shouldInitializeWorldOnEntry("/new")).toBe(false);
    expect(shouldInitializeWorldOnEntry("/new/")).toBe(false);
    expect(shouldInitializeWorldOnEntry("/dashboard")).toBe(true);
    expect(shouldInitializeWorldOnEntry("/match")).toBe(true);
  });
  it("keeps articles and dynamic league tables independent of the career world", () => {
    for (const path of [
      "/",
      "/guias/",
      "/planejamento-de-elenco",
      "/analise-de-partida-de-futebol",
      "/modo-carreira-de-jogador",
      "/tabelas",
      "/tabelas/brasileirao-serie-a",
      "/privacidade",
    ]) {
      expect(isPublicContentPath(path), path).toBe(true);
    }
  });
  it("still initializes the world for game routes, including similar prefixes", () => {
    for (const path of [
      "/new",
      "/dashboard",
      "/partida-rapida",
      "/match",
      "/jogador/novo",
      "/tabelas-privadas",
      "/clube/novo",
    ]) {
      expect(isPublicContentPath(path), path).toBe(false);
    }
  });
  it("preloads the locally hosted article heading font only on editorial content", () => {
    for (const route of ["/guias", "/guia-de-scouting", "/melhores-formacoes", "/sobre/"]) {
      expect(shouldPreloadArticleHeadingFont(route), route).toBe(true);
    }
    for (const route of ["/", "/partida-rapida", "/produtos", "/tabelas", "/tabelas/brasileirao-serie-a", "/new", "/dashboard"]) {
      expect(shouldPreloadArticleHeadingFont(route), route).toBe(false);
    }
  });

  it("uses light CSS for quick match without skipping world startup", () => {
    expect(isLightweightCssPath("/partida-rapida")).toBe(true);
    expect(isPublicContentPath("/partida-rapida")).toBe(false);
    expect(isLightweightCssPath("/guias")).toBe(true);
    expect(isLightweightCssPath("/dashboard")).toBe(false);
  });
});
