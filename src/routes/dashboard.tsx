import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { Dashboard } from "@/pages/dashboard";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => gamePageHead("/dashboard"),
  component: Dashboard,
});
