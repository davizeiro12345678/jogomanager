import { createFileRoute } from "@tanstack/react-router";

import { z } from "zod";

import { AthletePanelPage } from "@/pages/jogador.painel";

export const Route = createFileRoute("/jogador/painel")({
  ssr: false,
  validateSearch: z.object({
    slot: z.number().int().min(1).max(3).catch(1),
    tab: z
      .enum([
        "semana",
        "calendario",
        "saude",
        "atributos",
        "selecao",
        "contrato",
        "noticias",
        "historico",
      ])
      .optional(),
  }),
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
  component: AthletePanelPage,
});
