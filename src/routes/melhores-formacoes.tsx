import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/melhores-formacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/taticas-e-formacoes", statusCode: 301, replace: true });
  },
});
