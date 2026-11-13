import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => loadGamePageHead("/dashboard"),
  component: lazyRouteComponent(() => import("@/pages/dashboard"), "Dashboard"),
});
