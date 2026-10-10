import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { CSP_NONCE_HEADER, createCspNonce, secureResponse } from "./lib/security-headers";
import { publicPageRedirect } from "./lib/public-page-redirects";

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
    const nonce = createCspNonce();
    try {
      const redirect = publicPageRedirect(request);
      if (redirect) return secureResponse(redirect, request, nonce);
      const headers = new Headers(request.headers);
      headers.set(CSP_NONCE_HEADER, nonce);
      // Vite's development bridge can provide a Request-like object from a
      // different Undici realm. Passing that object directly to the Request
      // constructor throws before SSR starts (`private member #state`). Build
      // a standards-shaped request from its public fields instead, preserving
      // the streamed body only for methods that are allowed to have one.
      const init: RequestInit & { duplex?: "half" } = {
        method: request.method,
        headers,
      };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = request.body;
        init.duplex = "half";
      }
      const securedRequest = new Request(request.url, init);
      const handler = await getServerEntry();
      const response = await handler.fetch(securedRequest, env, ctx);
      return secureResponse(await normalizeCatastrophicSsrResponse(response), request, nonce);
    } catch (error) {
      console.error(error);
      return secureResponse(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        nonce,
      );
    }
  },
};
