import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { LeaguePage } from "@/pages/league";

export const Route = createFileRoute("/league")({
  ssr: false,
  head: () => loadGamePageHead("/league"),
  component: LeaguePage,
});
