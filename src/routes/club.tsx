import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/club")({
  ssr: false,
  head: () => loadGamePageHead("/club"),
  component: lazyRouteComponent(() => import("@/pages/club"), "ClubHub"),
});
