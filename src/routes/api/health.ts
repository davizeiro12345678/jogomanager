import { createFileRoute } from "@tanstack/react-router";
import { checkBackendHealth } from "@/lib/backend-health.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const health = await checkBackendHealth(process.env);
        return Response.json(health, {
          status: health.status === "ready" ? 200 : 503,
          headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      },
    },
  },
});
