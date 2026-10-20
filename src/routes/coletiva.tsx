/**
 * Coletiva de imprensa jogável: antes do jogo, 5 perguntas da imprensa e 3
 * tons de resposta. Cada resposta mexe com moral, diretoria, torcida e
 * pressão — e a manchete do dia seguinte nasce do seu tom.
 */
import { createFileRoute } from "@tanstack/react-router";

import { PressPage } from "@/pages/coletiva";

export const Route = createFileRoute("/coletiva")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Coletiva de imprensa · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Enfrente a imprensa antes do jogo: 5 perguntas, 3 tons de resposta e a manchete do dia seguinte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PressPage,
});
