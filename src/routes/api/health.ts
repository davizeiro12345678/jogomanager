import { createFileRoute } from "@tanstack/react-router";
import {
  checkBackendHealth,
  requestCloudflareBindings,
  selectBackendHealthEnvironment,
} from "@/lib/backend-health.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Use per-request adapter context when the native module is unavailable.
        // Never trust client-supplied headers as a source of environment keys.
        let workerBindings = requestCloudflareBindings(request);
        try {
          const native = (await import("cloudflare:workers")).env as Record<string, unknown>;
          if (native && typeof native === "object") {
            // Preserve request-scoped fallback values when the native object
            // omits a binding in a preview build.
            workerBindings = { ...workerBindings };
            for (const name of [
              "SUPABASE_URL",
              "SUPABASE_PUBLISHABLE_KEY",
              "SUPABASE_SERVICE_ROLE_KEY",
            ]) {
              if (typeof native[name] === "string" && native[name]) {
                workerBindings[name] = native[name];
              }
            }
          }
        } catch {
          // Node previews do not implement Cloudflare's native module scheme.
        }
        const health = await checkBackendHealth(
          selectBackendHealthEnvironment(process.env, workerBindings),
        );
        return Response.json(health, {
          status: health.status === "ready" ? 200 : 503,
          headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      },
    },
  },
});
