export const SITE_URL = "https://futebolmanager.xyz";
export const SITE_NAME = "Pro Football Manager 3D";
export const SITE_TITLE = "Pro Football Manager 3D: Jogo de Futebol Manager Online";
export const SITE_DESCRIPTION =
  "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.";
export const OG_IMAGE = `${SITE_URL}/og-cover.jpg`;

type Meta = Record<string, string>;

interface SeoInput {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  ogTitle?: string;
  ogDescription?: string;
  image?: string;
}

export function seoMeta(input: SeoInput): Meta[] {
  const url = `${SITE_URL}${input.path}`;
  const image = input.image ?? OG_IMAGE;
  return [
    { title: input.title },
    { name: "description", content: input.description },
    { property: "og:title", content: input.ogTitle ?? input.title },
    { property: "og:description", content: input.ogDescription ?? input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:image", content: image },
    { property: "og:locale", content: "pt_BR" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.ogTitle ?? input.title },
    { name: "twitter:description", content: input.ogDescription ?? input.description },
    { name: "twitter:image", content: image },
  ];
}

export function canonical(path: string) {
  return [{ rel: "canonical", href: `${SITE_URL}${path}` }];
}

export const noindexMeta: Meta[] = [{ name: "robots", content: "noindex, follow" }];

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: `${SITE_URL}${it.path}`,
      })),
    }),
  };
}

export function articleLd(opts: { headline: string; description: string; path: string }) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: opts.headline,
      description: opts.description,
      inLanguage: "pt-BR",
      image: OG_IMAGE,
      mainEntityOfPage: `${SITE_URL}${opts.path}`,
      author: { "@type": "Organization", name: SITE_NAME },
      publisher: { "@type": "Organization", name: SITE_NAME },
    }),
  };
}

export function gameLd() {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoGame",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      image: OG_IMAGE,
      inLanguage: "pt-BR",
      genre: ["Sports", "Simulation", "Management"],
      gamePlatform: ["Web Browser"],
      applicationCategory: "GameApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
      },
    }),
  };
}

export function itemListLd(name: string, items: string[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name,
      numberOfItems: items.length,
      itemListElement: items.map((n, i) => ({ "@type": "ListItem", position: i + 1, name: n })),
    }),
  };
}
