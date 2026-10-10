import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dicas-de-gestao")({
  beforeLoad: () => {
    throw redirect({ to: "/guias", statusCode: 301, replace: true });
  },
});
