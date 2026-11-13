import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/squad")({
  ssr: false,
  head: () => loadGamePageHead("/squad"),
  component: lazyRouteComponent(() => import("@/pages/squad"), "SquadPage"),
});
