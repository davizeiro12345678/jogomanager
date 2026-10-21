import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { CupPage } from "@/pages/cup";

export const Route = createFileRoute("/cup")({
  ssr: false,
  head: () => gamePageHead("/cup"),
  component: CupPage,
});
