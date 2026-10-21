import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { publicPageRedirect } from "./lib/public-page-redirects";
import { CSP_NONCE_HEADER, createCspNonce, secureResponse } from "./lib/security-headers";

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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // The duration only covers initial handler/response creation, not streamed body completion.
    const ssrStart = performance.now();
    const measured = (response: Response): Response => {
      const durationMs = Math.max(0, performance.now() - ssrStart);
      // secureResponse already builds a fresh mutable response; no extra copy.
      response.headers.append("server-timing", `app;dur=${durationMs.toFixed(1)}`);
      return response;
    };
    // Rebuild from public fields: a cross-realm Request may not be cloneable.
    // Never trust a client-provided CSP nonce.
    const headers = new Headers(request.headers);
    const nonce = createCspNonce();
    headers.set(CSP_NONCE_HEADER, nonce);
    const init: RequestInit & { duplex?: "half" } = { method: request.method, headers };
    if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
      init.body = request.body;
      init.duplex = "half";
    }
    const verifiedRequest = new Request(request.url, init);
    const protect = (response: Response) => secureResponse(response, verifiedRequest, nonce);
    const redirect = publicPageRedirect(verifiedRequest);
    if (redirect) return measured(protect(redirect));
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(verifiedRequest, env, ctx);
      return measured(protect(await normalizeCatastrophicSsrResponse(response)));
    } catch (error) {
      console.error(error);
      const errorResponse = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
      return measured(protect(errorResponse));
    }
  },
};
