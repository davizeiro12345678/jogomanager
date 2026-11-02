import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  articleLd,
  breadcrumbLd,
  canonical,
  gameLd,
  OG_IMAGE,
  seoMeta,
  SITE_URL,
  websiteLd,
} from "./seo";
import { HOME_LOCALES } from "./home-locales";

describe("page metadata", () => {
  it("uses explicit page keywords instead of repeating a global list", () => {
    const page = { title: "Clube", description: "Gestão", path: "/" };
    expect(seoMeta(page).some((tag) => tag["name"] === "keywords")).toBe(false);
    expect(
      seoMeta({ ...page, keywords: ["jogomanager", "jogo de técnico de futebol"] }).find(
        (tag) => tag["name"] === "keywords",
      )?.["content"],
    ).toBe("jogomanager, jogo de técnico de futebol");
  });

  it("links actual home language variants using absolute reciprocal targets", () => {
    expect(HOME_LOCALES).toEqual([
      { language: "pt-BR", path: "/" },
      { language: "en", path: "/en" },
      { language: "es", path: "/es" },
      { language: "x-default", path: "/" },
    ]);
    for (const lang of ["en", "es"] as const) {
      const html = readFileSync(new URL(`../../public/${lang}.html`, import.meta.url), "utf8");
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(`rel="canonical" href="${SITE_URL}/${lang}"`);
      for (const locale of HOME_LOCALES) {
        expect(html).toContain(`hreflang="${locale.language}" href="${SITE_URL}${locale.path}"`);
      }
    }
  });

  it("protects the independently served language pages", () => {
    const headers = readFileSync(new URL("../../public/_headers", import.meta.url), "utf8");
    for (const path of ["/en", "/es"]) {
      const section = headers.split("\n\n").find((part) => part.startsWith(`${path}\n`));
      expect(section).toContain("Content-Security-Policy:");
      expect(section).toContain("X-Content-Type-Options: nosniff");
      expect(section).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    }
  });

  it("shares one canonical identity and supplies accessible social images", () => {
    const meta = seoMeta({
      title: "Gráficos",
      description: "Prévia 3D",
      path: "/visual?utm_source=test#atletas",
    });
    expect(meta.find((tag) => tag["property"] === "og:url")?.["content"]).toBe(
      `${SITE_URL}/visual`,
    );
    expect(canonical("/visual?utm_source=test#atletas")[0]?.href).toBe(`${SITE_URL}/visual`);
    expect(meta.find((tag) => tag["property"] === "og:image")?.["content"]).toBe(OG_IMAGE);
    expect(meta.find((tag) => tag["property"] === "og:image:height")?.["content"]).toBe("640");
    expect(meta.find((tag) => tag["name"] === "twitter:image:alt")?.["content"]).toBeTruthy();
  });
  it("does not assign the cover dimensions to a different image", () => {
    const meta = seoMeta({
      title: "Clube",
      description: "Perfil",
      path: "/clube",
      image: `${SITE_URL}/icon-512.png`,
      imageAlt: "Escudo",
    });
    expect(meta.some((tag) => tag["property"] === "og:image:width")).toBe(false);
    expect(meta.find((tag) => tag["property"] === "og:image:alt")?.["content"]).toBe("Escudo");
  });
  it("connects website, publisher and game without invented ratings", () => {
    const site = JSON.parse(websiteLd().children);
    const game = JSON.parse(gameLd().children);
    expect(site["@graph"][0].mainEntity["@id"]).toBe(game["@id"]);
    expect(game.publisher["@id"]).toBe(site["@graph"][1]["@id"]);
    expect(game.aggregateRating).toBeUndefined();
  });
  it("preserves verifiable article publication and update dates for search", () => {
    const article = JSON.parse(
      articleLd({
        headline: "Guia de scouting",
        description: "Como avaliar jogadores",
        path: "/guia-de-scouting",
        datePublished: "2026-09-18",
        dateModified: "2026-10-13",
      }).children,
    );
    expect(article.datePublished).toBe("2026-09-18");
    expect(article.dateModified).toBe("2026-10-13");
    expect(article.mainEntityOfPage["@id"]).toBe(`${SITE_URL}/guia-de-scouting`);
  });

  it("keeps user-supplied article and breadcrumb names inside JSON-LD", () => {
    const name = '</script><script>alert("x")</script>';
    const article = articleLd({ headline: name, description: name, path: "/guia" });
    const breadcrumbs = breadcrumbLd([{ name, path: "/guia" }]);
    expect(article.children).not.toContain("</script>");
    expect(JSON.parse(article.children).headline).toBe(name);
    expect(JSON.parse(breadcrumbs.children).itemListElement[0].name).toBe(name);
  });
});
