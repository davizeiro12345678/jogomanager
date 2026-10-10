import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";
import { secureResponse, CSP_NONCE_HEADER } from "./lib/security-headers";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) return next();
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) throw error;
    console.error(error);
    return secureResponse(
      new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
      request,
      request.headers.get(CSP_NONCE_HEADER) ?? undefined,
    );
  }
});

// Defining start.ts opts out of Start's automatic CSRF middleware.
const csrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });
const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const result = await next();
  if (result.response instanceof Response) {
    result.response = secureResponse(
      result.response,
      request,
      request.headers.get(CSP_NONCE_HEADER) ?? undefined,
    );
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware, csrfMiddleware],
}));
