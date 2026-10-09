import { createFileRoute } from "@tanstack/react-router";

/**
 * Manual / scheduled importer trigger.
 * Protected by a shared secret so it can be called by cron but not by the public.
 *
 *   POST /api/public/sync-football?scope=seed|clubs|squads|history|premium|stats|career|all&limit=40&offset=0
 *   Header: x-sync-secret: <LOVABLE_CRON_SECRET>
 */
export const Route = createFileRoute("/api/public/sync-football")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["FOOTBALL_SYNC_SECRET"] || process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-sync-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const scope = url.searchParams.get("scope") ?? "clubs";
        if (scope === "apifootball") {
          const p = url.searchParams.get("phase");
          const allowed = ["leagues", "teams", "squads", "fixtures", "standings", "predictions", "odds", "stats",
            "countries", "timezones", "venues", "coaches", "injuries", "teamstats", "details"] as const;
          const phase = allowed.find((x) => x === p);
          if (!phase) {
            return new Response("Invalid phase", { status: 400 });
          }
          const n = (k: string, d: number, max: number) => {
            const v = Number(url.searchParams.get(k) ?? d);
            return Number.isSafeInteger(v) && v >= 0 && v <= max ? v : d;
          };
          const { runApiFootballImport } = await import("@/lib/apifootball-import.server");
          const r = await runApiFootballImport({
            phase,
            offset: n("offset", 0, 1_000_000),
            limit: Math.max(1, n("limit", 60, 500)),
            budgetMs: Math.max(5_000, n("budgetMs", 50_000, 90_000)),
          });
          return Response.json(r, { status: r.ok ? 200 : 500 });
        }
        if (
          ![
            "seed",
            "clubs",
            "squads",
            "history",
            "all",
            "premium",
            "stats",
            "career",
            "premium-chain",
          ].includes(scope)
        ) {
          return new Response("Invalid scope", { status: 400 });
        }
        const phase = url.searchParams.get("phase");
        const phases = [
          "leagues",
          "teams",
          "kits",
          "players",
          "schedule",
          "events",
          "details",
        ] as const;
        if (scope === "premium-chain" && (!phase || !phases.some((item) => item === phase))) {
          return new Response("Invalid premium phase", { status: 400 });
        }
        const leagueId = url.searchParams.get("leagueId") ?? undefined;
        const season = url.searchParams.get("season") ?? undefined;
        if (
          scope === "premium-chain" &&
          phase === "schedule" &&
          (!leagueId ||
            !/^\d{1,12}$/.test(leagueId) ||
            !season ||
            !/^\d{4}(?:-\d{4})?$/.test(season))
        ) {
          return new Response("Invalid league or season", { status: 400 });
        }
        const num = (k: string, d: number, min: number, max: number) => {
          const raw = url.searchParams.get(k);
          const value = raw === null ? d : Number(raw);
          return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
        };
        const limit = num("limit", scope === "career" ? 200 : 40, 1, 600);
        const offset = num("offset", 0, 0, 1_000_000);
        const concurrency = num("concurrency", 4, 1, 8);
        const budgetMs = num("budgetMs", 45_000, 5_000, 90_000);
        if (limit === null || offset === null || concurrency === null || budgetMs === null) {
          return new Response("Invalid pagination or budget", { status: 400 });
        }

        const { runSync } = await import("@/lib/football-sync.server");
        const result = await runSync({
          scope,
          limit,
          offset,
          concurrency,
          budgetMs,
          ...(leagueId ? { leagueId } : {}),
          ...(season ? { season } : {}),
          ...(scope === "premium-chain" ? { phase: phases.find((item) => item === phase) } : {}),
        });

        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});
