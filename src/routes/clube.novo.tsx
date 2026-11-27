import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

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
  // Browser-only page: keep its dependencies out of SSR Worker initialization.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/clube.novo"), "NewClubPage"),
});
