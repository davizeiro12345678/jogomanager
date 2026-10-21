import { createFileRoute } from "@tanstack/react-router";

import { Perfil } from "@/pages/perfil";

export const Route = createFileRoute("/perfil")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Perfil do treinador · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Veja sua trajetória como treinador: clubes comandados, títulos, conquistas, estatísticas de carreira e preferências do jogo.",
      },
      { property: "og:title", content: "Perfil do treinador · Pro Football Manager 3D" },
      {
        property: "og:description",
        content:
          "Veja sua trajetória como treinador: clubes comandados, títulos, conquistas, estatísticas de carreira e preferências do jogo.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Perfil,
});
