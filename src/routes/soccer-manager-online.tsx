import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/soccer-manager-online")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301, replace: true });
  },
});
