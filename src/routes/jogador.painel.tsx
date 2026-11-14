import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

import { athletePanelSearch } from "@/lib/athlete-route-search";

export const Route = createFileRoute("/jogador/painel")({
  ssr: false,
  validateSearch: athletePanelSearch,
  head: () => ({
    meta: [
      { title: "Painel do atleta — Football Manager 3D" },
      {
        name: "description",
        content:
          "Treino da semana, lances decisivos, contrato, propostas e histórico do seu jogador.",
      },
      { property: "og:title", content: "Painel do atleta — Football Manager 3D" },
      {
        property: "og:description",
        content: "Acompanhe a evolução do seu jogador semana a semana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  // Preserve validated route search, but do not bundle its browser UI into SSR.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/jogador.painel"), "AthletePanelPage"),
});
