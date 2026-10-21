import { createFileRoute } from "@tanstack/react-router";

import { ConquistasPage } from "@/pages/conquistas";

export const Route = createFileRoute("/conquistas")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Conquistas · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Acompanhe as conquistas do treinador e consulte os objetivos da sua carreira de futebol.",
      },
      {
        property: "og:title",
        content: "Conquistas · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Acompanhe as conquistas do treinador e consulte os objetivos da sua carreira de futebol.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConquistasPage,
});
