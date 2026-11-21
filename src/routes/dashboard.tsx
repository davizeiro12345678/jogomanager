import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => loadGamePageHead("/dashboard"),
  // The route never SSRs. Exclude its heavy client graph from the Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/dashboard"), "Dashboard"),
});
