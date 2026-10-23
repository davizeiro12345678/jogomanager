import { loadGamePageHead } from "@/lib/load-game-page-head";

import { createFileRoute } from "@tanstack/react-router";

import { TrainingPage } from "@/pages/training";

export const Route = createFileRoute("/training")({
  ssr: false,
  head: () => loadGamePageHead("/training"),
  component: TrainingPage,
});
