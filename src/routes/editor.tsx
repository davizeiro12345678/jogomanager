// ============================================================================
//  /editor
//  Modo editor e customização: elencos, clubes, competições e
//  importar/exportar. Tudo salvo no navegador via src/lib/customData.ts —
//  funciona sem login e é aplicado automaticamente ao mundo do jogo.
// ============================================================================

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/editor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Editor e customização · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Personalize clubes, competições, jogadores, elencos e dados do seu mundo de futebol manager.",
      },
      {
        property: "og:title",
        content: "Editor e customização · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Personalize clubes, competições, jogadores, elencos e dados do seu mundo de futebol manager.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // The route never SSRs. Exclude its heavy client graph from the Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/editor"), "EditorPage"),
});
