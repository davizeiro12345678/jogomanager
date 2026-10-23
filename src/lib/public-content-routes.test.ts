import { describe, expect, it } from "vitest";
import { isLightweightCssPath, isPublicContentPath } from "./public-content-routes";

describe("public content isolation", () => {
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
  it("uses light CSS for quick match without skipping world startup", () => {
    expect(isLightweightCssPath("/partida-rapida")).toBe(true);
    expect(isPublicContentPath("/partida-rapida")).toBe(false);
    expect(isLightweightCssPath("/guias")).toBe(true);
    expect(isLightweightCssPath("/dashboard")).toBe(false);
  });
});
