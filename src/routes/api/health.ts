import { createFileRoute } from "@tanstack/react-router";
import { checkBackendHealth, selectBackendHealthEnvironment } from "@/lib/backend-health.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        // Cloudflare-native bindings are authoritative. process.env is the
        // fallback for local Node preview and non-Worker deployments.
        let workerBindings: Record<string, unknown> | undefined;
        try {
          workerBindings = (await import("cloudflare:workers")).env as Record<string, unknown>;
        } catch {
          // Node preview does not implement the Cloudflare module scheme.
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
