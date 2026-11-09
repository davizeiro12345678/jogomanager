import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/internal/email-automations/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) {
          denied.headers.set("cache-control", "no-store");
          return denied;
        }
        // The caller selects neither a contact, payload, nor an event. Only
        // committed database sources can populate this private queue.
        const { dispatchEmailAutomations } = await import("@/lib/email-automation-dispatch.server");
        try {
          return Response.json(await dispatchEmailAutomations(), {
            headers: { "cache-control": "no-store" },
          });
        } catch {
          return Response.json(
            { ok: false, error: "Email automation dispatch unavailable; inspect private queue." },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
