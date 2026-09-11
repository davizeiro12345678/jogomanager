import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { publicBaseUrlFor as baseUrlFor } from "@/lib/site-host";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const body = [
          "User-agent: Googlebot",
          "Allow: /",
          "",
          "User-agent: Bingbot",
          "Allow: /",
          "",
          "User-agent: Twitterbot",
          "Allow: /",
          "",
          "User-agent: facebookexternalhit",
          "Allow: /",
          "",
          "User-agent: *",
          "Allow: /",
          "",
          `Sitemap: ${baseUrlFor(request)}/sitemap.xml`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
