import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/loja")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Loja · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte os itens disponíveis na loja da sua carreira e confira os detalhes antes de comprar.",
      },
      {
        property: "og:title",
        content: "Loja · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte os itens disponíveis na loja da sua carreira e confira os detalhes antes de comprar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // Browser-only page: keep its dependencies out of SSR Worker initialization.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/loja"), "LojaPage"),
});
