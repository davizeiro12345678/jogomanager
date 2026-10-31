import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ token: z.string().min(1).max(4096) }).strict();

/** An authenticated player can test only their own registered device, once per hour. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason?: string }> => {
    const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim() ?? "";
    const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] ?? "";
    const supabaseUrl = process.env["SUPABASE_URL"] ?? "";
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
    if (!projectId || !serviceAccountJson || !supabaseUrl || !serviceKey)
      return { ok: false, reason: "unavailable" };
    const { data: subscription, error } = await context.supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("token", data.token)
      .maybeSingle();
    if (error || !subscription) return { ok: false, reason: "not_registered" };
    try {
      const headers: Record<string, string> = {
        apikey: serviceKey,
        "content-type": "application/json",
      };
      if (!serviceKey.startsWith("sb_secret_")) headers["authorization"] = `Bearer ${serviceKey}`;
      const reserve = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_firebase_push_test`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_user_id: context.userId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!reserve.ok) return { ok: false, reason: "unavailable" };
      if ((await reserve.json()) !== true) return { ok: false, reason: "rate_limited" };
      const { sendFirebaseTestPush } = await import("./firebase-delivery.server");
      await sendFirebaseTestPush({ projectId, serviceAccountJson, deviceToken: data.token });
      return { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });
