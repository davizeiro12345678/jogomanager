import { createFileRoute } from "@tanstack/react-router";

import { ComprasPage } from "@/pages/compras";

export const Route = createFileRoute("/compras")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Minhas compras · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte o histórico das suas compras, pagamentos e itens adquiridos para acompanhar a entrega na sua conta.",
      },
      {
        property: "og:title",
        content: "Minhas compras · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte o histórico das suas compras, pagamentos e itens adquiridos para acompanhar a entrega na sua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComprasPage,
});
