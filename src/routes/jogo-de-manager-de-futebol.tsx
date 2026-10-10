import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/jogo-de-manager-de-futebol")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301, replace: true });
  },
});
