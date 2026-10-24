import { createFileRoute } from "@tanstack/react-router";

import { loadGamePageHead } from "@/lib/load-game-page-head";

import { MultiplayerPage } from "@/pages/multiplayer";

export const Route = createFileRoute("/multiplayer")({
  ssr: false,
  head: () => loadGamePageHead("/multiplayer"),
  component: MultiplayerPage,
});
