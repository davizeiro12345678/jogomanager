import { createFileRoute } from "@tanstack/react-router";

import { PreMatchPage } from "@/pages/pre-jogo";

export const Route = createFileRoute("/pre-jogo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pré-jogo — Football Manager 3D" },
      {
        name: "description",
        content: "Escalações, forma recente e narração antes do apito inicial.",
      },
      { property: "og:title", content: "Pré-jogo — Football Manager 3D" },
      { property: "og:description", content: "Prepare o confronto como numa transmissão de TV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: PreMatchPage,
});
