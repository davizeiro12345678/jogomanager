import { createFileRoute } from "@tanstack/react-router";

import { CadastroPage } from "@/pages/cadastro";

export const Route = createFileRoute("/cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      {
        title: "Cadastrar clubes e jogadores · Pro Football Manager 3D",
      },
      {
        name: "description",
        content:
          "Cadastre clubes e jogadores personalizados e organize os dados usados nas suas partidas e carreiras.",
      },
      {
        property: "og:title",
        content: "Cadastro de clubes e jogadores · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Cadastre clubes e jogadores personalizados e organize os dados usados nas suas partidas e carreiras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CadastroPage,
});
