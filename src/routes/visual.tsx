import { loadGamePageHead } from "@/lib/load-game-page-head";

/**
 * /visual — Ajustes visuais do jogo.
 *
 * Tudo aqui é salvo no navegador (localStorage) e lido pelo estádio 3D e pela
 * "cara" da partida: texturas, densidade da grama, detalhe dos jogadores,
 * torcida, clima, horário, corte do gramado (geral e por clube) e efeitos.
 */

import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/visual")({
  ssr: false,
  head: () => loadGamePageHead("/visual"),
  component: lazyRouteComponent(() => import("@/pages/visual"), "VisualPage"),
});
