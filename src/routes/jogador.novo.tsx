import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

import { createAthleteSearch } from "@/lib/athlete-route-search";

export const Route = createFileRoute("/jogador/novo")({
  ssr: false,
  validateSearch: createAthleteSearch,
  head: () => ({
    meta: [
      { title: "Criar atleta — Football Manager 3D" },
      {
        name: "description",
        content: "Monte seu jogador: posição, físico, aparência, personalidade e origem.",
      },
      { property: "og:title", content: "Criar atleta — Football Manager 3D" },
      {
        property: "og:description",
        content: "Escolha de onde você vem e comece sua carreira no futebol.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  // Preserve validated route search, but do not bundle its browser UI into SSR.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/jogador.novo"), "CreateAthletePage"),
});
