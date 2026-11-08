/**
 * Server-only Firebase Cloud Messaging sends through the Lovable connector
 * gateway. Notifications are best-effort: an FCM outage must never block a
 * chat message or a club service, so callers use the fire-and-forget wrapper
 * and failures are logged, never thrown.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
/** Upper bound of device tokens contacted for a single event. */
export const MAX_TOKENS_PER_EVENT = 200;

export interface PushMessage {
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped. */
  path?: string;
}

type PushAdmin = SupabaseClient<Database>;

/** True when FCM says the device token is gone and the stored row must be deleted. */
export function isDeadToken(status: number, body: string): boolean {
  if (status !== 404 && status !== 400) return false;
  if (status === 404 && body.trim() === "UNREGISTERED") return true;
  try {
    const { error } = JSON.parse(body) as {
      error?: { details?: { "@type"?: string; errorCode?: string }[]; message?: string };
    };
    const code = error?.details?.find(
      (detail) => detail["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError",
    )?.errorCode;
    return status === 404
      ? code === "UNREGISTERED"
      : code === "INVALID_ARGUMENT" && /registration token/i.test(error?.message ?? "");
  } catch {
    return false;
  }
}

function gatewayKeys(): { lovableKey: string; fcmKey: string } | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fcmKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  return lovableKey && fcmKey ? { lovableKey, fcmKey } : null;
}

export async function sendPushToTokens(
  tokens: readonly string[],
  message: PushMessage,
): Promise<{ sent: number; deadTokens: string[] }> {
  const keys = gatewayKeys();
  const deadTokens: string[] = [];
  if (!keys) return { sent: 0, deadTokens };
  let sent = 0;
  for (const token of tokens.slice(0, MAX_TOKENS_PER_EVENT)) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${keys.lovableKey}`,
        "X-Connection-Api-Key": keys.fcmKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: message.title, body: message.body.slice(0, 300) },
          data: message.path ? { path: message.path } : undefined,
        },
      }),
    });
    if (res.ok) {
      sent += 1;
      continue;
    }
    const body = await res.text();
    if (isDeadToken(res.status, body)) {
      deadTokens.push(token);
      continue;
    }
    console.error(`FCM falhou [${res.status}]`);
  }
  return { sent, deadTokens };
}

/** Sends a push to every subscribed device of the given users; dead tokens are removed. */
export async function sendPushToUsers(
  admin: PushAdmin,
  userIds: readonly string[],
  message: PushMessage,
): Promise<void> {
  if (userIds.length === 0) return;
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("token")
    .in("user_id", [...userIds])
    .limit(MAX_TOKENS_PER_EVENT);
  if (error) {
    console.error("push_subscriptions lookup failed", error.message);
    return;
  }
  const tokens = (data ?? []).map((row) => row.token);
  const { deadTokens } = await sendPushToTokens(tokens, message);
  if (deadTokens.length === 0) return;
  const { error: cleanup } = await admin
    .from("push_subscriptions")
    .delete()
    .in("token", deadTokens);
  if (cleanup) console.error("push token cleanup failed", cleanup.message);
}

/** Fire-and-forget wrapper so callers never await or fail on push delivery. */
export function notifyUsers(
  admin: PushAdmin,
  userIds: readonly string[],
  message: PushMessage,
): void {
  sendPushToUsers(admin, userIds, message).catch((error: unknown) =>
    console.error("Push indisponível", error instanceof Error ? error.message : error),
  );
}
