import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/transfers")({
  ssr: false,
  head: () => loadGamePageHead("/transfers"),
  component: lazyRouteComponent(() => import("@/pages/transfers"), "TransfersPage"),
});
