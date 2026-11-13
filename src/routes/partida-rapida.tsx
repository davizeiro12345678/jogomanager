import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { canonical, noindexMeta, seoMeta } from "@/lib/seo";

export const Route = createFileRoute("/partida-rapida")({
  // Selection uses serializable catalogue data; the 3D match remains lazy.
  ssr: true,
  head: () => ({
    meta: [
      ...seoMeta({
        title: "Partida rápida em 3D · Pro Football Manager 3D",
        path: "/partida-rapida",
        description:
          "Escolha seu clube e o adversário, ajuste a dificuldade e acompanhe a partida em 3D com diferentes câmeras. Jogue contra o computador sem alterar sua carreira.",
      }),
      ...noindexMeta,
    ],
    links: canonical("/partida-rapida"),
  }),
  // Preserve server-rendered selection/SEO; load the page only for this route.
  component: lazyRouteComponent(() => import("@/components/game/QuickMatchPage"), "QuickMatchPage"),
});
