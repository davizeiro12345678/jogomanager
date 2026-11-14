import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

import { loadGamePageHead } from "@/lib/load-game-page-head";

export const Route = createFileRoute("/multiplayer")({
  ssr: false,
  head: () => loadGamePageHead("/multiplayer"),
  // Defer the browser-only graph: do not eagerly link 3D/physics into SSR.
  // The route never SSRs. Exclude its heavy client graph from the Worker build.
  component: import.meta.env.SSR
    ? () => null
    : lazyRouteComponent(() => import("@/pages/multiplayer"), "MultiplayerPage"),
});
