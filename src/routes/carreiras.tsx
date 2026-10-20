import { createFileRoute } from "@tanstack/react-router";

import { CareersHub } from "@/pages/carreiras";

export const Route = createFileRoute("/carreiras")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Minhas carreiras · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Retome suas carreiras de treinador e jogador neste aparelho.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: CareersHub,
});
