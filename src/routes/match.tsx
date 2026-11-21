import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/match")({
  ssr: false,
  head: () => loadGamePageHead("/match"),
  // Defer the browser-only graph: do not eagerly link 3D/physics into SSR.
  // The route never SSRs. Exclude its heavy client graph from the Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/match"), "MatchPage"),
});
