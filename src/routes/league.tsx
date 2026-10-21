import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { LeaguePage } from "@/pages/league";

export const Route = createFileRoute("/league")({
  ssr: false,
  head: () => gamePageHead("/league"),
  component: LeaguePage,
});
