import "@tanstack/react-start/server-only";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deliverEmailAutomationEvent,
  parseEmailAutomationLease,
  validEmailAutomationKey,
  type EmailAutomationOutcome,
} from "./email-automation.server";

// Keep the new RPC contract local until types are regenerated against the
// forward migration. Every result is validated before leaving this server.
interface AutomationRpcClient {
  rpc(name: "claim_email_automation"): PromiseLike<{ data: unknown; error: unknown }>;
  rpc(
    name: "complete_email_automation",
    args: {
      p_id: string;
      p_lease_token: string;
      p_outcome: EmailAutomationOutcome["outcome"];
      p_http_status: number | null;
      p_retry_after_seconds: number;
    },
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

export type EmailAutomationDispatchResult = {
  enabled: boolean;
  attempted: number;
  accepted: number;
  retryQueued: number;
  rejected: number;
  uncertain: number;
};

/** Called only by the authenticated internal route; no recipient/event input. */
export async function dispatchEmailAutomations(): Promise<EmailAutomationDispatchResult> {
  const result: EmailAutomationDispatchResult = {
    enabled: process.env["EMAIL_AUTOMATIONS_ENABLED"] === "true",
    attempted: 0,
    accepted: 0,
    retryQueued: 0,
    rejected: 0,
    uncertain: 0,
  };
  if (!result.enabled) return result;
  const key = process.env["RESEND_API_KEY"];
  if (!validEmailAutomationKey(key)) {
    throw new Error("Email automation provider is not configured.");
  }
  const database = supabaseAdmin as unknown as AutomationRpcClient;
  // Claim one at a time, so an upstream failure does not strand a batch of
  // untouched reservations. DB admission serializes all worker instances.
  for (let index = 0; index < 10; index++) {
    const claim = await database.rpc("claim_email_automation");
    if (claim.error) throw new Error("Email automation reservation failed.");
    if (claim.data === null) break;
    const lease = parseEmailAutomationLease(claim.data);
    const delivery = await deliverEmailAutomationEvent(lease, key);
    result.attempted++;
    const completed = await database.rpc("complete_email_automation", {
      p_id: lease.id,
      p_lease_token: lease.leaseToken,
      p_outcome: delivery.outcome,
      p_http_status: delivery.httpStatus,
      p_retry_after_seconds: delivery.retryAfterSeconds,
    });
    if (completed.error || completed.data !== true) {
      // Never try delivery again here. The expired lease becomes uncertain.
      throw new Error("Email automation acknowledgement requires reconciliation.");
    }
    if (delivery.outcome === "sent") result.accepted++;
    if (delivery.outcome === "retry") {
      if (lease.attempt >= 6) result.rejected++;
      else result.retryQueued++;
    }
    if (delivery.outcome === "dead") result.rejected++;
    if (delivery.outcome === "uncertain") result.uncertain++;
    // Stop before making more provider calls on a rate limit or any failure.
    if (delivery.outcome !== "sent") break;
    if (index < 9) await new Promise<void>((resolve) => setTimeout(resolve, 650));
  }
  return result;
}
