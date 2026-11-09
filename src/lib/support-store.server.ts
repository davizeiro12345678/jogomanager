import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import type { SupportStore } from "./support-webhook.server";

const Reservation = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("leased"),
    leaseToken: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }),
    payload: z.object({
      email: z.string().email().max(254),
      category: z.string(),
      message: z.string().max(4000),
    }),
  }),
  z.object({ status: z.enum(["sent", "pending", "conflict", "rate_limited", "unavailable"]) }),
]);
interface SupportRpcClient {
  rpc(
    name: "reserve_support_request" | "finish_support_request",
    args: Record<string, Json>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}
export async function createSupportStore(): Promise<SupportStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The forward migration adds only these server-owned RPCs; generated types follow release.
  const client = supabaseAdmin as unknown as SupportRpcClient;
  return {
    async reserve(userId, requestId, hash, payload) {
      const result = await client.rpc("reserve_support_request", {
        p_user_id: userId,
        p_request_id: requestId,
        p_payload_hash: hash,
        p_payload: payload,
      });
      if (result.error) throw new Error("Support reservation unavailable");
      return Reservation.parse(result.data);
    },
    async finish(userId, requestId, leaseToken, delivered) {
      const result = await client.rpc("finish_support_request", {
        p_user_id: userId,
        p_request_id: requestId,
        p_lease_token: leaseToken,
        p_delivered: delivered,
      });
      return !result.error && result.data === true;
    },
  };
}
