import { createFileRoute } from "@tanstack/react-router";

import { AthleteHub } from "@/pages/jogador.index";

export const Route = createFileRoute("/jogador/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Carreira de jogador — Football Manager 3D" },
      {
        name: "description",
        content: "Crie seu atleta, evolua da base ao auge e escreva sua história no futebol.",
      },
      { property: "og:title", content: "Carreira de jogador — Football Manager 3D" },
      {
        property: "og:description",
        content: "Da base à aposentadoria: treinos, contratos, seleção e prêmios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: AthleteHub,
});
