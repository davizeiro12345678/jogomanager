import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/cup")({
  ssr: false,
  head: () => loadGamePageHead("/cup"),
  component: lazyRouteComponent(() => import("@/pages/cup"), "CupPage"),
});
