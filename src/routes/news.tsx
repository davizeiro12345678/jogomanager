import { createFileRoute } from "@tanstack/react-router";

import { NewsPage } from "@/pages/news";

export const Route = createFileRoute("/news")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Notícias · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Leia as notícias da rodada e acompanhe os acontecimentos do clube e das competições da sua carreira.",
      },
      {
        property: "og:title",
        content: "Notícias · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Leia as notícias da rodada e acompanhe os acontecimentos do clube e das competições da sua carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewsPage,
});
