import { createFileRoute } from "@tanstack/react-router";

/**
 * Manual / scheduled importer trigger.
 * Protected by a shared secret so it can be called by cron but not by the public.
 *
 *   POST /api/public/sync-football?scope=seed|clubs|squads&limit=40&offset=0
 *   Header: x-sync-secret: <LOVABLE_CRON_SECRET>
 */
export const Route = createFileRoute("/api/public/sync-football")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-sync-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const scope = url.searchParams.get("scope") ?? "clubs";
        const num = (k: string, d: number) => Number(url.searchParams.get(k) ?? d) || d;
        const limit = num("limit", scope === "all" ? 600 : 40);
        const offset = num("offset", 0);
        const concurrency = num("concurrency", 8);
        const budgetMs = num("budgetMs", scope === "all" ? 90_000 : 45_000);

        const { runSync } = await import("@/lib/football-sync.server");
        const result = await runSync({ scope, limit, offset, concurrency, budgetMs });

        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
