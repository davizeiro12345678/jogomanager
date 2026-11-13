import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/league")({
  ssr: false,
  head: () => loadGamePageHead("/league"),
  component: lazyRouteComponent(() => import("@/pages/league"), "LeaguePage"),
});
