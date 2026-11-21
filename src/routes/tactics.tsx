import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/tactics")({
  ssr: false,
  head: () => loadGamePageHead("/tactics"),
  // The route never SSRs. Exclude its heavy client graph from the Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/tactics"), "TacticsPage"),
});
