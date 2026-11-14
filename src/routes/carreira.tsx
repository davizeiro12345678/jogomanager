/**
 * Carreira de treinador: cada semana você escolhe o foco do trabalho, vê o
 * efeito no elenco e na diretoria, e a rodada é resolvida. Momentos marcantes
 * abrem cenas 3D (treino, vestiário, sala de troféus, comissão técnica).
 */
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/carreira")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Carreira de treinador · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte a trajetória do treinador, suas propostas e os próximos passos para continuar a carreira em outro clube.",
      },
      {
        property: "og:title",
        content: "Carreira de treinador · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte a trajetória do treinador, suas propostas e os próximos passos para continuar a carreira em outro clube.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // The route never SSRs. Exclude its heavy client graph from the Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/carreira"), "CoachCareerPage"),
});
