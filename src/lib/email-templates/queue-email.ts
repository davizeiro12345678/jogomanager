/**
 * Server-only durable email enqueue. Authentication codes and reset links
 * must use Supabase SMTP directly, never the delayed notification queue.
 */
export async function enqueueRenderedNotification(message: {
  template: "welcome" | "season-start" | "career-milestone";
  recipient: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<string> {
  const origin = process.env["SUPABASE_URL"];
  const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!origin?.startsWith("https://") || !serviceRole)
    throw new Error("Private notification outbox is not configured");
  if (!message.idempotencyKey || message.idempotencyKey.length > 256)
    throw new Error("A stable notification idempotency key is required");

  const keyBytes = new TextEncoder().encode(
    [message.template, message.recipient, message.idempotencyKey].join("|"),
  );
  const digest = await crypto.subtle.digest("SHA-256", keyBytes);
  const key = Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
  const traceId = crypto.randomUUID().replaceAll("-", "");
  const endpoint = new URL("/rest/v1/rpc/jm_queue_notification", origin);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: serviceRole,
      authorization: `Bearer ${serviceRole}`,
      traceparent: `00-${traceId}-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}-01`,
    },
    body: JSON.stringify({
      p_key: key,
      p_template: message.template,
      p_trace_id: traceId,
      p_payload: {
        to: message.recipient,
        from: message.from,
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Notification enqueue failed: HTTP ${response.status}`);
  const id: unknown = await response.json();
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))
    throw new Error("Invalid notification queue confirmation");
  return id;
}
