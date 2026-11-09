import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SupportRequestInput, type SupportResult } from "./support-input";

export const getSupportAvailability = createServerFn({ method: "GET" }).handler(async () => {
  const { readSupportConfiguration } = await import("./support-webhook.server");
  return { enabled: readSupportConfiguration() !== null };
});

export const submitSupportRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SupportRequestInput.parse(input))
  .handler(async ({ data, context }): Promise<SupportResult> => {
    const { dispatchSupportRequest, readSupportConfiguration } =
      await import("./support-webhook.server");
    const configuration = readSupportConfiguration();
    if (!configuration || data.website) return { ok: false, reason: "unavailable" };
    try {
      const { verifiedAccount } = await import("./verified-identity.server");
      const user = await verifiedAccount(context.supabase, context.userId);
      if (!user) return { ok: false, reason: "verification_required" };
      const { createSupportStore } = await import("./support-store.server");
      return dispatchSupportRequest(
        data,
        { id: user.id, email: user.email! },
        await createSupportStore(),
        { configuration },
      );
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });
