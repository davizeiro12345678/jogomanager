import { Readable, pipeline } from "node:stream";
import { createGzip, constants } from "node:zlib";

// Compress only anonymous public HTML. Private pages, API bodies and event
// streams retain their own transport policy. Keep the SSR body streaming.
const PUBLIC_HTML_PATHS = new Set([
  "/",
  "/guias",
  "/guia-de-scouting",
  "/melhores-formacoes",
  "/partida-rapida",
  "/dicas-de-gestao",
  "/mercado-de-transferencias",
  "/planejamento-de-elenco",
  "/jogar-offline",
  "/perguntas-frequentes",
  "/privacidade",
  "/termos",
  "/contato",
  "/sobre",
  "/criador",
  "/jogo-de-manager-de-futebol",
  "/carreira-jogador",
]);

function acceptsGzip(header: string): boolean {
  const entries = header
    .toLowerCase()
    .split(",")
    .map((part) => part.trim().split(";"));
  const gzip = entries.find(([name]) => name === "gzip");
  const selected = gzip ?? entries.find(([name]) => name === "*");
  if (!selected) return false;
  const quality = selected.slice(1).find((value) => value.trim().startsWith("q="));
  return quality === undefined || Number(quality.trim().slice(2)) > 0;
}

export function compressPublicHtml(response: Response, request: Request): Response {
  if (
    request.method !== "GET" ||
    response.status !== 200 ||
    !response.body ||
    !PUBLIC_HTML_PATHS.has(new URL(request.url).pathname) ||
    request.headers.has("authorization") ||
    request.headers.has("cookie") ||
    request.headers.has("range") ||
    response.headers.has("content-encoding") ||
    response.headers.has("set-cookie") ||
    !response.headers.get("content-type")?.toLowerCase().startsWith("text/html")
  )
    return response;
  const headers = new Headers(response.headers);
  const vary = headers.get("vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "accept-encoding")) {
    headers.set("vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  }
  if (!acceptsGzip(request.headers.get("accept-encoding") ?? "")) {
    return new Response(response.body, { status: response.status, headers });
  }
  headers.set("content-encoding", "gzip");
  headers.delete("content-length");
  // Entity tags over the uncompressed bytes no longer describe this representation.
  headers.delete("etag");
  // Flush each SSR chunk so a pending secondary section cannot hold the hero.
  const gzip = createGzip({ flush: constants.Z_SYNC_FLUSH });
  pipeline(
    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
    gzip,
    () => {
      // pipeline propagates errors/cancellation to both streams; toWeb exposes
      // the same failure to the HTTP consumer rather than returning partial HTML.
    },
  );
  const init: ResponseInit & { encodeBody: "manual" } = {
    status: response.status,
    headers,
    // Workers otherwise compress an already encoded body a second time.
    // Node's standard Response ignores this Cloudflare-specific option.
    encodeBody: "manual",
  };
  return new Response(Readable.toWeb(gzip) as ReadableStream<Uint8Array>, init);
}
