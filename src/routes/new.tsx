import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/new")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Crie seu treinador e escolha seu clube · Pro Football Manager 3D" },
      {
        property: "og:title",
        content: "Crie seu treinador e escolha seu clube · Pro Football Manager 3D",
      },
      {
        property: "og:description",
        content:
          "Personalize seu treinador, escolha um clube e comece sua carreira no futebol em 3D.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "description",
        content:
          "Crie sua identidade, personalize seu treinador e encontre o clube para a sua próxima história no futebol.",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/pages/new"), "NewCareer"),
});
