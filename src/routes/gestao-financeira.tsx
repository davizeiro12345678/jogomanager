import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/gestao-financeira")({
  beforeLoad: () => {
    throw redirect({ to: "/planejamento-de-elenco", statusCode: 301, replace: true });
  },
});
