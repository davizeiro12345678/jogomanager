import { createFileRoute } from "@tanstack/react-router";

import { StatsPage } from "@/pages/stats";

export const Route = createFileRoute("/stats")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Estatísticas do elenco · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Compare os números do elenco, o desempenho dos jogadores e as estatísticas da temporada.",
      },
      {
        property: "og:title",
        content: "Estatísticas do elenco · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Compare os números do elenco, o desempenho dos jogadores e as estatísticas da temporada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatsPage,
});
