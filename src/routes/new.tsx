import { createFileRoute } from "@tanstack/react-router";

import { NewCareer } from "@/pages/new";

export const Route = createFileRoute("/new")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Crie seu treinador e escolha seu clube · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie sua identidade, personalize seu treinador e encontre o clube para a sua próxima história no futebol.",
      },
    ],
  }),
  component: NewCareer,
});
