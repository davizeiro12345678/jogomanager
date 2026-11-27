import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preserve older coach-career links without duplicating an authenticated page. */
export const Route = createFileRoute("/modo-carreira")({
  beforeLoad: () => {
    throw redirect({ to: "/carreira", replace: true });
  },
});
