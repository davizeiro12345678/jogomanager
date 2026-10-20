import { createFileRoute } from "@tanstack/react-router";

import { ScoutingPage } from "@/pages/scouting";

export const Route = createFileRoute("/scouting")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Olheiros e relatórios · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte relatórios dos olheiros, compare alvos e encontre reforços adequados ao elenco e ao orçamento.",
      },
      {
        property: "og:title",
        content: "Olheiros e relatórios · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte relatórios dos olheiros, compare alvos e encontre reforços adequados ao elenco e ao orçamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScoutingPage,
});
