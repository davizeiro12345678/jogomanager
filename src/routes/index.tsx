import { createFileRoute } from "@tanstack/react-router";
import { FootballHome } from "@/components/home/FootballHome";
import { getLeagueDigests } from "@/lib/real-football.functions";
import { canonical, gameLd, websiteLd, seoMeta, HOME_KEYWORDS, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";
import heroMobileAvif from "@/assets/hero-stadium.jpg?format=avif&w=390;450&aspect=1:2&fit=cover&position=centre&quality=44&as=srcset";
import heroAvif from "@/assets/hero-stadium.jpg?format=avif&w=640;1024;1080;1600&quality=52&as=srcset";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...seoMeta({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        path: "/",
        keywords: HOME_KEYWORDS,
        ogTitle: "jogomanager: o jogo de técnico de futebol grátis em 3D",
        ogDescription:
          "Da várzea à final, cada decisão é sua. Monte o elenco, escolha a tática e assista à partida em 3D no celular ou PC — grátis e sem instalar.",
      }),
      { name: "google-site-verification", content: "jQnHkMGkHJbJedGaIYWIRl14nynSHLVLLvHfzLfpTXg" },
    ],
    links: [
      ...canonical("/"),
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
