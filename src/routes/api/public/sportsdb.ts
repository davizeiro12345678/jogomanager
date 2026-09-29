import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sportsdb")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const sportsDb = await import("@/lib/sportsdb-cloudflare.server");
          const archiveKey = url.searchParams.get("archiveKey");
          if (archiveKey) {
            const archive = await sportsDb.readSportsDbArchive(archiveKey);
            return archive ?? Response.json({ error: "Arquivo n�o encontrado" }, { status: 404 });
          }
          if (url.searchParams.get("archives") === "1") {
            const limit = Number(url.searchParams.get("limit") ?? 50);
            const offset = Number(url.searchParams.get("offset") ?? 0);
            if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) {
              return Response.json({ error: "Pagina��o inv�lida" }, { status: 400 });
            }
            return Response.json(await sportsDb.listSportsDbArchives(limit, offset), {
              headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" },
            });
          }
          if (url.searchParams.get("status") === "1") {
            return Response.json(await sportsDb.readSportsDbStatus(), {
              headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" },
            });
          }
          const entityType = url.searchParams.get("entity") ?? "league_index";
          const limit = Number(url.searchParams.get("limit") ?? 50);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) {
            return Response.json({ error: "Pagina��o inv�lida" }, { status: 400 });
          }
          const data = await sportsDb.querySportsDbRecords({
            entityType,
            query: url.searchParams.get("q") ?? undefined,
            parentId: url.searchParams.get("parent") ?? undefined,
            limit,
            offset,
          });
          return Response.json(data, {
            headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao ler os dados esportivos";
          const status = message.includes("binding SPORTS_DB") ? 503 : 500;
          return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});

