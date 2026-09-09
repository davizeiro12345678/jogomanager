import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://soccer-manager.fun";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/jogo-de-manager-de-futebol", changefreq: "weekly", priority: "0.9" },
          { path: "/soccer-manager-online", changefreq: "weekly", priority: "0.9" },
          { path: "/ligas-de-futebol", changefreq: "weekly", priority: "0.9" },
          { path: "/brasileirao", changefreq: "weekly", priority: "0.9" },
          { path: "/taticas-e-formacoes", changefreq: "weekly", priority: "0.8" },
          { path: "/como-ser-tecnico-de-futebol", changefreq: "weekly", priority: "0.8" },
          { path: "/mercado-de-transferencias", changefreq: "weekly", priority: "0.8" },
          { path: "/guias", changefreq: "weekly", priority: "0.8" },
          { path: "/dicas-de-gestao", changefreq: "weekly", priority: "0.8" },
          { path: "/melhores-formacoes", changefreq: "weekly", priority: "0.8" },
          { path: "/guia-de-scouting", changefreq: "weekly", priority: "0.8" },
          { path: "/gestao-financeira", changefreq: "weekly", priority: "0.8" },
          { path: "/glossario-do-futebol", changefreq: "monthly", priority: "0.7" },
          { path: "/jogar-offline", changefreq: "monthly", priority: "0.7" },
          { path: "/comparativo-jogos-manager", changefreq: "monthly", priority: "0.7" },
          { path: "/multiplayer", changefreq: "weekly", priority: "0.6" },
          { path: "/perguntas-frequentes", changefreq: "monthly", priority: "0.7" },
          { path: "/produtos", changefreq: "monthly", priority: "0.7" },
          { path: "/criador", changefreq: "monthly", priority: "0.5" },

        ];

        const lastmod = new Date().toISOString().slice(0, 10);



        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
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
