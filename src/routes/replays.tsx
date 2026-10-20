import { createFileRoute } from "@tanstack/react-router";

import { ReplaysPage } from "@/pages/replays";

export const Route = createFileRoute("/replays")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Galeria de replays · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Reveja os lances salvos das partidas em 3D e organize sua galeria de replays.",
      },
      {
        property: "og:title",
        content: "Galeria de replays · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content: "Reveja os lances salvos das partidas em 3D e organize sua galeria de replays.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReplaysPage,
});
