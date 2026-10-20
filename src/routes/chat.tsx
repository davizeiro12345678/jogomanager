import { createFileRoute } from "@tanstack/react-router";

import { ChatPage } from "@/pages/chat";

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Chat global · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Converse com outros treinadores no chat global da comunidade e compartilhe suas experiências no jogo.",
      },
      {
        property: "og:title",
        content: "Chat global · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Converse com outros treinadores no chat global da comunidade e compartilhe suas experiências no jogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});
