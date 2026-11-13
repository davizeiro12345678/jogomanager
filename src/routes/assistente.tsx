import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/assistente")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Assistente de IA · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Peça sugestões ao assistente de IA para analisar seu elenco, planejar contratações e preparar a tática da próxima partida.",
      },
      {
        property: "og:title",
        content: "Assistente de IA · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Peça sugestões ao assistente de IA para analisar seu elenco, planejar contratações e preparar a tática da próxima partida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Assistente de IA · Pro Football Manager 3D" },
      {
        name: "twitter:description",
        content: "O cérebro de IA da sua carreira: análises, notícias e táticas sob medida.",
      },
    ],
  }),
  // Keep the browser's module graph out of the SSR Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/assistente"), "AssistentePage"),
});
