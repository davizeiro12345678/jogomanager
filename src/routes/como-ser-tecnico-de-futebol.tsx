import { createFileRoute, redirect } from "@tanstack/react-router";
import { PUBLIC_PAGE_REDIRECTS } from "@/lib/public-page-redirects";

// Consolidated into the in-depth beginner handbook at /guias.
// Keep a permanent redirect for readers and links using the original URL.
export const Route = createFileRoute("/como-ser-tecnico-de-futebol")({
  beforeLoad: () => {
    throw redirect({
      href: PUBLIC_PAGE_REDIRECTS["/como-ser-tecnico-de-futebol"],
      statusCode: 301,
    });
  },
});
