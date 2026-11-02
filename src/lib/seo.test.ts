import { describe, expect, it } from "vitest";
import {
  articleLd,
  breadcrumbLd,
  canonical,
  gameLd,
  homeLanguageLinks,
  OG_IMAGE,
  seoMeta,
  SITE_URL,
  websiteLd,
} from "./seo";
import { homeLocale } from "./home-locale";
import { isPublicContentPath } from "./public-content-routes";

describe("page metadata", () => {
  it("links actual home language variants using absolute reciprocal targets", () => {
    expect(homeLanguageLinks()).toEqual([
      { rel: "alternate", hrefLang: "pt-BR", href: `${SITE_URL}/` },
      { rel: "alternate", hrefLang: "en", href: `${SITE_URL}/en` },
      { rel: "alternate", hrefLang: "es", href: `${SITE_URL}/es` },
      { rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/` },
    ]);
    for (const [path, lang] of [
      ["/en", "en"],
      ["/es/", "es"],
    ] as const) {
      expect(homeLocale(path)).toBe(lang);
      expect(isPublicContentPath(path)).toBe(true);
    }
    expect(homeLocale("/guias")).toBeNull();
  });

  it("uses the language-specific social locale without changing the canonical URL", () => {
    const meta = seoMeta({
      title: "Football manager",
      description: "Play",
      path: "/en",
      locale: "en_US",
    });
    expect(meta.find((tag) => tag["property"] === "og:locale")?.["content"]).toBe("en_US");
    expect(canonical("/en")[0]?.href).toBe(`${SITE_URL}/en`);
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
