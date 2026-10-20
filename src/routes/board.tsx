import { createFileRoute } from "@tanstack/react-router";

import { BoardPage } from "@/pages/board";

export const Route = createFileRoute("/board")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Sala da diretoria · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte as metas da diretoria, a confiança no treinador e as decisões que orientam o projeto esportivo do seu clube.",
      },
      {
        property: "og:title",
        content: "Sala da diretoria · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte as metas da diretoria, a confiança no treinador e as decisões que orientam o projeto esportivo do seu clube.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoardPage,
});
