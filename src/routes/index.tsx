import { createFileRoute } from "@tanstack/react-router";
import { FootballHome } from "@/components/home/FootballHome";
import { canonical, gameLd, websiteLd, seoMeta, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      ...seoMeta({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        path: "/",
        ogTitle: "Pro Football Manager 3D | Seu clube. Sua história.",
        ogDescription:
          "Crie seu treinador, assuma um clube e acompanhe suas decisões no gramado em 3D. Comece a sua carreira direto no navegador.",
      }),
      { name: "google-site-verification", content: "jQnHkMGkHJbJedGaIYWIRl14nynSHLVLLvHfzLfpTXg" },
    ],
    links: canonical("/"),
    scripts: [websiteLd(), gameLd()],
  }),
  component: FootballHome,
});
