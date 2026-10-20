import { QueryClient } from "@tanstack/react-query";

import { createRouter } from "@tanstack/react-router";

import { createIsomorphicFn } from "@tanstack/react-start";

import { getRequest } from "@tanstack/react-start/server";

import { RoutePending } from "@/components/RoutePending";
import { routeTree } from "./routeTree.gen";

// The outer entry replaces this header per request. Router applies the nonce
// to streamed hydration and route-owned scripts without buffering the HTML.
const requestNonce = createIsomorphicFn()
  .server(() => getRequest().headers.get("x-manager-csp-nonce") ?? undefined)
  .client(() => undefined);

export const getRouter = () => {
  const queryClient = new QueryClient();
  const nonce = requestNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    ...(nonce ? { ssr: { nonce } } : {}),
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 300,
  });

  return router;
};
