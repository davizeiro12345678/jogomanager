import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupportTicketInput, type SubmitSupportTicketResult } from "./support-input";

export type { SubmitSupportTicketResult } from "./support-input";

/** Identity and the reply address come only from the revalidated account. */
export const submitSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SupportTicketInput.parse(input))
  .handler(async ({ data, context }): Promise<SubmitSupportTicketResult> => {
    const { supportWebhookConfig, enqueueSupportTicket } = await import("./support.server");
    const config = supportWebhookConfig(process.env);
    if (!config) return { ok: false, reason: "unavailable" };
    const { verifiedAccount } = await import("./verified-identity.server");
    const account = await verifiedAccount(context.supabase, context.userId);
    if (!account?.email) return { ok: false, reason: "verification_required" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return enqueueSupportTicket(supabaseAdmin, context.userId, account.email, data, config);
  });
