import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const pushTokenSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((token) => !/\s/u.test(token), "Invalid push token");

const pushTokenRequest = z.object({ token: pushTokenSchema }).strict();

/** Server-only ownership lookup; clients cannot query push_subscriptions directly. */
export const readOwnedPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => pushTokenRequest.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscription, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("token", data.token)
      .maybeSingle();
    return { ok: !error, owned: !error && subscription?.user_id === context.userId };
  });
/** Deletion is server-only and always scoped to the authenticated owner. */
export const cleanupForeignPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => pushTokenRequest.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", context.userId)
      .eq("token", data.token);
    return { ok: !error };
  });
/** The subscription is transferred only after the user explicitly opts in. */
export const upsertPushSubscriptionForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => pushTokenRequest.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id")
      .eq("token", data.token)
      .maybeSingle();
    if (lookupError) return { ok: false, reason: "database_error" as const };
    if (existing && existing.user_id !== context.userId)
      return { ok: false, reason: "token_owned_by_another_account" as const };

    const { error: writeError } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        token: data.token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token", ignoreDuplicates: true },
    );
    if (writeError) return { ok: false, reason: "database_error" as const };

    // Ignore-on-conflict prevents a concurrent session from being reassigned.
    // Re-read to distinguish a same-owner replay from a foreign token race.
    const { data: verified, error: verifyError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("user_id")
      .eq("token", data.token)
      .maybeSingle();
    if (verifyError) return { ok: false, reason: "database_error" as const };
    if (verified && verified.user_id === context.userId) return { ok: true as const };
    return { ok: false, reason: "token_owned_by_another_account" as const };
  });
