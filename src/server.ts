import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { withCloudflareBindings } from "./lib/cloudflare-bindings.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function handleSportsDbApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path !== "/api/public/sportsdb" && path !== "/api/public/sportsdb-import") return null;
  const sportsDb = await import("./lib/sportsdb-cloudflare.server");

  if (path === "/api/public/sportsdb") {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { allow: "GET" } });
    try {
      const archiveKey = url.searchParams.get("archiveKey");
      if (archiveKey) {
        return await sportsDb.readSportsDbArchive(archiveKey)
          ?? Response.json({ error: "Arquivo não encontrado" }, { status: 404 });
      }
      if (url.searchParams.get("archives") === "1") {
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) {
          return Response.json({ error: "Paginação inválida" }, { status: 400 });
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
        return Response.json({ error: "Paginação inválida" }, { status: 400 });
      }
      return Response.json(await sportsDb.querySportsDbRecords({
        entityType,
        query: url.searchParams.get("q") ?? undefined,
        parentId: url.searchParams.get("parent") ?? undefined,
        limit,
        offset,
      }), { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ler os dados esportivos";
      const status = message.includes("binding SPORTS_DB") ? 503 : 500;
      return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
    }
  }

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  if (!sportsDb.authorizeSportsDbImport(request.headers.get("x-sportsdb-import-secret"))) {
    return Response.json({ error: "Não autorizado" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  let body: { phase?: unknown; limit?: unknown } = {};
  try { body = await request.json() as typeof body; } catch { /* query parameters are also accepted */ }
  const phase = typeof body.phase === "string" ? body.phase : url.searchParams.get("phase") ?? "";
  const rawLimit = typeof body.limit === "number" ? body.limit : Number(url.searchParams.get("limit") ?? 2);
  if (phase !== "next" && phase !== "resume" && !sportsDb.isSportsDbImportPhase(phase)) {
    return Response.json({ error: "Fase inválida", phases: ["catalog", "leagues", "teams-index", "teams", "players", "schedules", "rounds", "tables", "events"] }, {
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
    const message = error instanceof Error ? error.message : "Falha durante a importação";
    const rateLimited = error instanceof Error && error.name === "SportsDbRateLimitError";
    const archiveLimit = message.includes("SPORTSDB_ARCHIVE_LIMIT");
    if (archiveLimit) await sportsDb.pauseSportsDbImport("R2 archive budget reached").catch(() => undefined);
    return Response.json({ error: archiveLimit ? "Limite de 2,5 GB do arquivo R2 atingido" : message, phase, archiveLimit }, {
      status: archiveLimit ? 507 : rateLimited ? 429 : 502,
      headers: { "cache-control": "no-store", ...(rateLimited ? { "retry-after": "60" } : {}) },
    });
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    return withCloudflareBindings(env, async () => {
      const sportsDbResponse = await handleSportsDbApiRequest(request);
      if (sportsDbResponse) return sportsDbResponse;
      try {
        const handler = await getServerEntry();
        const response = await handler.fetch(request, env, ctx);
        return await normalizeCatastrophicSsrResponse(response);
      } catch (error) {
        console.error(error);
        return new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    });
  },
  scheduled(_event: unknown, env: unknown, ctx: { waitUntil: (promise: Promise<unknown>) => void }) {
    ctx.waitUntil(withCloudflareBindings(env, async () => {
      try {
        const sportsDb = await import("./lib/sportsdb-cloudflare.server");
        await sportsDb.runNextSportsDbImportBatch(8);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown import failure";
        const rateLimited = error instanceof Error && error.name === "SportsDbRateLimitError";
        if (!rateLimited) {
          try {
            const sportsDb = await import("./lib/sportsdb-cloudflare.server");
            await sportsDb.pauseSportsDbImport(message);
          } catch {
            // Leave the scheduled import stopped by the runtime error until bindings are fixed.
          }
        }
        console.error("TheSportsDB scheduled import failed", { message, retryAfterSeconds: rateLimited ? 60 : null });
      }
    }));
  },
};
