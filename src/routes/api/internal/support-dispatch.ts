import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/internal/support-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rejected = await authenticateCronRequest(request);
        if (rejected) return rejected;
        const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
        const { supportWebhookConfig, dispatchSupportOutbox } =
          await import("@/lib/support.server");
        const config = supportWebhookConfig(process.env);
        if (!config)
          return Response.json({ ok: false, reason: "unavailable" }, { status: 503, headers });
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const result = await dispatchSupportOutbox(supabaseAdmin, config);
          return Response.json({ ok: true, ...result }, { headers });
        } catch {
          return Response.json({ ok: false, reason: "unavailable" }, { status: 503, headers });
        }
      },
    },
  },
});
