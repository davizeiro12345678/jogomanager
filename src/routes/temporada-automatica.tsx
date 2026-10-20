import { createFileRoute } from "@tanstack/react-router";

import { AutoSeasonPage } from "@/pages/temporada-automatica";

export const Route = createFileRoute("/temporada-automatica")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Temporada automática · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Configure a simulação automática e acompanhe o avanço das rodadas e o histórico de partidas da carreira.",
      },
      {
        property: "og:title",
        content: "Temporada automática · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Configure a simulação automática e acompanhe o avanço das rodadas e o histórico de partidas da carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AutoSeasonPage,
});
