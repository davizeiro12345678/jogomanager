import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/como-ser-tecnico-de-futebol")({
  beforeLoad: () => {
    throw redirect({ to: "/guias", statusCode: 301, replace: true });
  },
});
