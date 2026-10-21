import { createFileRoute } from "@tanstack/react-router";

import { CheckoutReturn } from "@/pages/checkout/return";

export const Route = createFileRoute("/checkout/return")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Resultado do pagamento · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Consulte a confirmação do pagamento e acompanhe a entrega dos itens comprados para sua carreira.",
      },
      {
        property: "og:title",
        content: "Resultado do pagamento · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Consulte a confirmação do pagamento e acompanhe a entrega dos itens comprados para sua carreira.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => {
    const id = typeof search["session_id"] === "string" ? search["session_id"] : undefined;
    return id && /^cs_[a-zA-Z0-9_]+$/.test(id) ? { session_id: id } : {};
  },
  component: CheckoutReturn,
});
