import { createFileRoute } from "@tanstack/react-router";

import { NewClubPage } from "@/pages/clube.novo";

export const Route = createFileRoute("/clube/novo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar seu clube · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie um clube próprio com nome, escudo, uniformes, estádio e torcida para iniciar uma carreira personalizada.",
      },
      {
        property: "og:title",
        content: "Criar seu clube · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Crie um clube próprio com nome, escudo, uniformes, estádio e torcida para iniciar uma carreira personalizada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NewClubPage,
});
