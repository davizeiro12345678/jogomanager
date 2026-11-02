import { createFileRoute } from "@tanstack/react-router";
import { FootballHome } from "@/components/home/FootballHome";
import { getLeagueDigests } from "@/lib/real-football.functions";
import {
  canonical,
  gameLd,
  homeLanguageLinks,
  websiteLd,
  seoMeta,
  SITE_TITLE,
  SITE_DESCRIPTION,
} from "@/lib/seo";
import heroMobileAvif from "@/assets/hero-stadium.jpg?format=avif&w=390;450&aspect=1:2&fit=cover&position=centre&quality=44&as=srcset";
import heroAvif from "@/assets/hero-stadium.jpg?format=avif&w=640;1024;1080;1600&quality=52&as=srcset";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...seoMeta({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        path: "/",
        ogTitle: "jogomanager | Seu clube, suas decisões em 3D",
        ogDescription:
          "Crie seu treinador, monte o time e acompanhe partidas em 3D. Comece sua carreira grátis no navegador.",
        keywords: [
          "jogomanager",
          "jogo de técnico de futebol",
          "jogo grátis de futebol",
          "manager de futebol",
          "jogo de treinador de futebol",
          "jogo de futebol no navegador",
          "carreira de técnico",
          "simulador de futebol 3D",
          "gestão de clube de futebol",
        ],
      }),
      { name: "google-site-verification", content: "jQnHkMGkHJbJedGaIYWIRl14nynSHLVLLvHfzLfpTXg" },
    ],
    links: [
      ...canonical("/"),
      ...homeLanguageLinks(),
      {
        rel: "preload",
        as: "image",
        type: "image/avif",
        imageSrcSet: heroMobileAvif,
        imageSizes: "100vw",
        media: "(max-width: 640px)",
        fetchPriority: "high",
      },
      {
        rel: "preload",
        as: "image",
        type: "image/avif",
        imageSrcSet: heroAvif,
        media: "(min-width: 641px)",
        imageSizes: "100vw",
        fetchPriority: "high",
      },
    ],
    scripts: [websiteLd(), gameLd()],
  }),
  // The secondary league section streams independently; a slow backend must
  // not hold the first byte, hero discovery or the primary navigation hostage.
  loader: () => ({ leagues: getLeagueDigests().catch(() => []) }),
  component: FootballHome,
});
