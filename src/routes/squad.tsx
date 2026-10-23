import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { SquadPage } from "@/pages/squad";

export const Route = createFileRoute("/squad")({
  ssr: false,
  head: () => loadGamePageHead("/squad"),
  component: SquadPage,
});
