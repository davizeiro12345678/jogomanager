import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { CupPage } from "@/pages/cup";

export const Route = createFileRoute("/cup")({
  ssr: false,
  head: () => loadGamePageHead("/cup"),
  component: CupPage,
});
