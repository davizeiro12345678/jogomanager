import { gamePageHead } from "@/lib/game-page-metadata";

import { createFileRoute } from "@tanstack/react-router";

import { TrainingPage } from "@/pages/training";

export const Route = createFileRoute("/training")({
  ssr: false,
  head: () => gamePageHead("/training"),
  component: TrainingPage,
});
