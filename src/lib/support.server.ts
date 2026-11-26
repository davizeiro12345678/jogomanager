import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database";
import type { SupportTicketRequest, SubmitSupportTicketResult } from "./support-input";

type SupportDatabase = Pick<SupabaseClient<Database>, "rpc">;
type SupportEnvironment = Record<string, string | undefined>;
export interface SupportWebhookConfig {
  url: string;
  secret: string;
}
export interface SupportDispatchResult {
  claimed: number;
  delivered: number;
  retryQueued: number;
  failed: number;
  acknowledgementFailed: number;
}

/** The endpoint is server-configured, never accepted from a ticket or request. */
export function supportWebhookConfig(env: SupportEnvironment): SupportWebhookConfig | null {
  const raw = env["SUPPORT_WEBHOOK_URL"];
  const secret = env["SUPPORT_WEBHOOK_SECRET"];
  if (
    !raw ||
    raw.length > 2048 ||
    /[\r\n\0]/.test(raw) ||
    !secret ||
    secret.length < 32 ||
    secret.length > 1024 ||
    /[\r\n\0]/.test(secret)
  )
    return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    // Permit public DNS names only; direct IPv4/IPv6, local suffixes and
    // credentials are not valid destinations for the support queue.
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== "443") ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(host)
    )
      return null;
    return { url: url.href, secret };
  } catch {
    return null;
  }
}

export function signSupportPayload(body: string, timestamp: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex")}`;
}

/** A lease is acknowledged only after a 2xx; the body is never logged or read. */
export async function dispatchSupportOutbox(
  db: SupportDatabase,
  config: SupportWebhookConfig,
  options: { maxJobs?: number; ticketId?: string; fetch?: typeof fetch; now?: () => number } = {},
): Promise<SupportDispatchResult> {
  const limit = Math.max(1, Math.min(3, Math.floor(options.maxJobs ?? 3)));
  const { data: jobs, error } = await db.rpc("claim_support_deliveries", {
    p_limit: limit,
    p_ticket_id: options.ticketId ?? null,
  });
  if (error) throw new Error("Support delivery claim failed");
  const result: SupportDispatchResult = {
    claimed: jobs?.length ?? 0,
    delivered: 0,
    retryQueued: 0,
    failed: 0,
    acknowledgementFailed: 0,
  };
  for (const job of jobs ?? []) {
    const body = JSON.stringify({
      version: 1,
      event: "support.ticket.created",
      ticket: {
        id: job.ticket_id,
        category: job.category,
        subject: job.subject,
        message: job.message,
        createdAt: job.created_at,
        replyTo: job.email,
        userId: job.user_id,
      },
    });
    const timestamp = String(Math.floor((options.now?.() ?? Date.now()) / 1000));
    let delivered = false;
    let retryable = true;
    let errorCode = "network_or_timeout";
    try {
      const response = await (options.fetch ?? fetch)(config.url, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `support-${job.ticket_id}`,
          "X-Support-Timestamp": timestamp,
          "X-Support-Signature": signSupportPayload(body, timestamp, config.secret),
        },
        body,
      });
      delivered = response.ok;
      errorCode = delivered ? "" : `http_${response.status}`;
      retryable = [408, 425, 429].includes(response.status) || response.status >= 500;
      await response.body?.cancel().catch(() => undefined);
    } catch {
      /* The durable lease and stable idempotency key cover ambiguous delivery. */
    }
    const acknowledged = await db.rpc("complete_support_delivery", {
      p_ticket_id: job.ticket_id,
      p_lease_token: job.lease_token,
      p_delivered: delivered,
      p_error_code: errorCode,
      p_retryable: retryable,
    });
    if (acknowledged.error || acknowledged.data !== true) result.acknowledgementFailed += 1;
    else if (delivered) result.delivered += 1;
    else if (retryable && job.attempts < 5) result.retryQueued += 1;
    else result.failed += 1;
  }
  return result;
}

export async function enqueueSupportTicket(
  db: SupportDatabase,
  userId: string,
  email: string,
  input: SupportTicketRequest,
  config: SupportWebhookConfig,
): Promise<SubmitSupportTicketResult> {
  try {
    const { data, error } = await db.rpc("create_support_ticket", {
      p_user_id: userId,
      p_email: email,
      p_request_id: input.requestId,
      p_category: input.category,
      p_subject: input.subject,
      p_message: input.message,
    });
    if (error)
      return {
        ok: false,
        reason: error.message.includes("support_rate_limited") ? "rate_limited" : "error",
      };
    const ticket = data?.[0];
    if (!ticket) return { ok: false, reason: "error" };
    if (ticket.status === "delivered")
      return { ok: true, ticketId: ticket.ticket_id, status: "delivered" };
    if (ticket.status === "delivery_failed")
      return { ok: true, ticketId: ticket.ticket_id, status: "delivery_failed" };
    try {
      const dispatch = await dispatchSupportOutbox(db, config, {
        maxJobs: 1,
        ticketId: ticket.ticket_id,
      });
      if (dispatch.delivered === 1)
        return { ok: true, ticketId: ticket.ticket_id, status: "delivered" };
      if (dispatch.failed === 1)
        return { ok: true, ticketId: ticket.ticket_id, status: "delivery_failed" };
    } catch {
      /* A stored ticket survives a provider outage and is retried by cron. */
    }
    return { ok: true, ticketId: ticket.ticket_id, status: "queued" };
  } catch {
    return { ok: false, reason: "error" };
  }
}
