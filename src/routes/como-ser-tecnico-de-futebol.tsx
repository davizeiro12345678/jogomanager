import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidated into the in-depth beginner handbook at /guias.
// Keep a permanent redirect for readers and links using the original URL.
export const Route = createFileRoute("/como-ser-tecnico-de-futebol")({
  beforeLoad: () => {
    throw redirect({ href: "/guias", statusCode: 301 });
  },
});
