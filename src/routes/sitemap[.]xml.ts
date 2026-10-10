import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { publicBaseUrlFor as baseUrlFor } from "@/lib/site-host";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const BASE_URL = baseUrlFor(request);
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/ligas-de-futebol", changefreq: "weekly", priority: "0.9" },
          { path: "/brasileirao", changefreq: "weekly", priority: "0.9" },
          { path: "/taticas-e-formacoes", changefreq: "weekly", priority: "0.8" },
          { path: "/guias", changefreq: "weekly", priority: "0.8" },
          { path: "/planejamento-de-elenco", changefreq: "weekly", priority: "0.8" },
          { path: "/analise-de-partida-de-futebol", changefreq: "weekly", priority: "0.8" },
          { path: "/modo-carreira-de-jogador", changefreq: "weekly", priority: "0.8" },
          { path: "/regras", changefreq: "monthly", priority: "0.8" },
          { path: "/glossario-do-futebol", changefreq: "monthly", priority: "0.7" },
          { path: "/jogar-offline", changefreq: "monthly", priority: "0.7" },
          { path: "/comparativo-jogos-manager", changefreq: "monthly", priority: "0.7" },
          { path: "/perguntas-frequentes", changefreq: "monthly", priority: "0.7" },
          { path: "/produtos", changefreq: "monthly", priority: "0.7" },
          { path: "/sobre", changefreq: "monthly", priority: "0.7" },
          { path: "/criador", changefreq: "monthly", priority: "0.5" },
          { path: "/contato", changefreq: "monthly", priority: "0.5" },
          { path: "/privacidade", changefreq: "yearly", priority: "0.4" },
          { path: "/termos", changefreq: "yearly", priority: "0.4" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
