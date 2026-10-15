import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserva links antigos sem duplicar a página pública de carreira de jogador. */
export const Route = createFileRoute("/carreira-jogador")({
  beforeLoad: () => {
    throw redirect({ to: "/modo-carreira-de-jogador", replace: true });
  },
});
