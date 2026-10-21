import { createFileRoute } from "@tanstack/react-router";

import { HistoryPage } from "@/pages/history";

export const Route = createFileRoute("/history")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "História e troféus · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Reveja temporadas, resultados e troféus conquistados pelo treinador ao longo da carreira.",
      },
      {
        property: "og:title",
        content: "História e troféus · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Reveja temporadas, resultados e troféus conquistados pelo treinador ao longo da carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});
