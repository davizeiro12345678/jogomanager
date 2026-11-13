import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";


export const Route = createFileRoute("/match")({
  ssr: false,
  head: () => loadGamePageHead("/match"),
  // Defer the browser-only graph: do not eagerly link 3D/physics into SSR.
  component: lazyRouteComponent(() => import("@/pages/match"), "MatchPage"),
});
