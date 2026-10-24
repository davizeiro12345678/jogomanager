import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { Dashboard } from "@/pages/dashboard";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => loadGamePageHead("/dashboard"),
  component: Dashboard,
});
