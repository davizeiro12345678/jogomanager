export const SITE_URL = "https://jogomanager.com";
export const SITE_NAME = "Pro Football Manager 3D";
export const SITE_TITLE = "Pro Football Manager 3D | Manager de futebol grátis";
export const SITE_DESCRIPTION =
  "Jogue Pro Football Manager 3D grátis no navegador. Escolha um clube, defina táticas, faça transferências e acompanhe partidas ao vivo em 3D no PC ou celular.";
export const OG_IMAGE = `${SITE_URL}/og-cover.jpg`;
export const SITE_KEYWORDS = [
  "manager de futebol",
  "jogo de futebol 3D",
  "simulação de futebol",
  "gestão de clubes",
  "táticas de futebol",
  "mercado de transferências",
  "jogo no navegador",
];
const IMAGE_ALT = "Pro Football Manager 3D — gestão de clubes e partidas de futebol em estádio 3D";

type Meta = Record<string, string>;

interface SeoInput {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  ogTitle?: string;
  ogDescription?: string;
  image?: string;
  imageAlt?: string;
  keywords?: readonly string[];
}

/** Page identities exclude tracking parameters and fragments. */
function pageUrl(path: string) {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, SITE_URL);
  return `${SITE_URL}${url.pathname}`;
}

/** A title cannot close an inline script when rendered as JSON-LD. */
function structuredData(value: Record<string, unknown>) {
  return { type: "application/ld+json", children: JSON.stringify(value).replace(/</g, "\\u003c") };
}

export function seoMeta(input: SeoInput): Meta[] {
  const url = pageUrl(input.path);
  const image = input.image ?? OG_IMAGE;
  const imageAlt = input.imageAlt ?? IMAGE_ALT;
  return [
    { title: input.title },
    { name: "description", content: input.description },
    { name: "keywords", content: (input.keywords ?? SITE_KEYWORDS).join(", ") },
    { property: "og:title", content: input.ogTitle ?? input.title },
    { property: "og:description", content: input.ogDescription ?? input.description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:image", content: image },
    { property: "og:image:alt", content: imageAlt },
    ...(image === OG_IMAGE
      ? [
          { property: "og:image:type", content: "image/jpeg" },
          { property: "og:image:width", content: "1200" },
          { property: "og:image:height", content: "640" },
        ]
      : []),
    { property: "og:locale", content: "pt_BR" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.ogTitle ?? input.title },
    { name: "twitter:description", content: input.ogDescription ?? input.description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: imageAlt },
  ];
}

export function canonical(path: string) {
  return [{ rel: "canonical", href: pageUrl(path) }];
}

export const noindexMeta: Meta[] = [{ name: "robots", content: "noindex, follow" }];

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return structuredData({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: pageUrl(it.path),
    })),
  });
}

export function articleLd(opts: { headline: string; description: string; path: string }) {
  return structuredData({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    inLanguage: "pt-BR",
    image: OG_IMAGE,
    mainEntityOfPage: pageUrl(opts.path),
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@type": "Organization", name: SITE_NAME },
  });
}

export function websiteLd() {
  return structuredData({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: "pt-BR",
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntity: { "@id": `${SITE_URL}/#game` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
      },
    ],
  });
}

export function gameLd() {
  return structuredData({
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "@id": `${SITE_URL}/#game`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    image: OG_IMAGE,
    inLanguage: "pt-BR",
    genre: ["Sports", "Simulation", "Management"],
    gamePlatform: ["Web Browser"],
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    browserRequirements: "JavaScript e WebGL2 para partidas 3D",
    keywords: SITE_KEYWORDS.join(", "),
    featureList: [
      "Carreira de treinador",
      "Gestão de elenco e transferências",
      "Formações e táticas",
      "Partidas de futebol em 3D",
      "Ajustes de qualidade gráfica",
    ],
    isAccessibleForFree: true,
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
    },
  });
}

export function itemListLd(name: string, items: string[]) {
  return structuredData({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((n, i) => ({ "@type": "ListItem", position: i + 1, name: n })),
  });
}
