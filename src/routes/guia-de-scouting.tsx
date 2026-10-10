import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/guia-de-scouting")({
  beforeLoad: () => {
    throw redirect({ to: "/planejamento-de-elenco", statusCode: 301, replace: true });
  },
});
