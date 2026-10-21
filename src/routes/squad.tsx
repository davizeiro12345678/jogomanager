import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { SquadPage } from "@/pages/squad";

export const Route = createFileRoute("/squad")({
  ssr: false,
  head: () => gamePageHead("/squad"),
  component: SquadPage,
});
