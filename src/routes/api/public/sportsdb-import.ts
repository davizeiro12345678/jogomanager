import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sportsdb-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sportsDb = await import("@/lib/sportsdb-cloudflare.server");
        if (!sportsDb.authorizeSportsDbImport(request.headers.get("x-sportsdb-import-secret"))) {
          return Response.json({ error: "N�o autorizado" }, { status: 401, headers: { "cache-control": "no-store" } });
        }
        let body: { phase?: unknown; limit?: unknown } = {};
        try { body = await request.json() as typeof body; } catch { /* query parameters are also accepted */ }
        const url = new URL(request.url);
        const phase = typeof body.phase === "string" ? body.phase : url.searchParams.get("phase") ?? "";
        const rawLimit = typeof body.limit === "number" ? body.limit : Number(url.searchParams.get("limit") ?? 2);
        if (phase !== "next" && phase !== "resume" && !sportsDb.isSportsDbImportPhase(phase)) {
          return Response.json({ error: "Fase inv�lida", phases: ["catalog", "leagues", "teams-index", "teams", "players", "schedules", "events"] }, {
            status: 400,
            headers: { "cache-control": "no-store" },
          });
        }
        if (!Number.isSafeInteger(rawLimit) || rawLimit < 1 || rawLimit > 8) {
          return Response.json({ error: "O lote deve ter entre 1 e 8 itens" }, { status: 400, headers: { "cache-control": "no-store" } });
        }
        try {
          let result: Awaited<ReturnType<typeof sportsDb.runNextSportsDbImportBatch>>
            | Awaited<ReturnType<typeof sportsDb.runSportsDbImportBatch>>;
          if (phase === "resume") {
            await sportsDb.resumeSportsDbImport();
            result = await sportsDb.runNextSportsDbImportBatch(rawLimit);
          } else if (phase === "next") {
            result = await sportsDb.runNextSportsDbImportBatch(rawLimit);
          } else {
            result = await sportsDb.runSportsDbImportBatch(phase, rawLimit);
          }
          return Response.json(result, { headers: { "cache-control": "no-store" } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha durante a importa��o";
          const rateLimited = error instanceof Error && error.name === "SportsDbRateLimitError";
          const archiveLimit = message.includes("SPORTSDB_ARCHIVE_LIMIT");
          if (archiveLimit) await sportsDb.pauseSportsDbImport("R2 archive budget reached").catch(() => undefined);
          return Response.json({ error: archiveLimit ? "Limite de 2,5 GB do arquivo R2 atingido" : message, phase, archiveLimit }, {
            status: archiveLimit ? 507 : rateLimited ? 429 : 502,
            headers: { "cache-control": "no-store", ...(rateLimited ? { "retry-after": "60" } : {}) },
          });
        }
      },
    },
  },
});

