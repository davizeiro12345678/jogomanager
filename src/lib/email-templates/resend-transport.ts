/**
 * Server-only Resend transport. Never import into a browser route.
 * Retries only rate limits and temporary upstream errors, with the SAME
 * idempotency key so ambiguous accepted requests cannot create two emails.
 */
export interface ResendTransactionalMessage {
  key: string;
  from: string;
  recipient: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string;
}

function validateMessage(message: ResendTransactionalMessage): void {
  // Reject control characters in fields that become mail headers. Although
  // Resend accepts JSON, untrusted values must never become multi-line headers.
  for (const [field, value] of [
    ["from", message.from],
    ["recipient", message.recipient],
    ["subject", message.subject],
    ["replyTo", message.replyTo ?? ""],
    ["idempotencyKey", message.idempotencyKey],
  ] as const) {
    if (/[\x00-\x1f\x7f]/.test(value)) {
      throw new Error(`Invalid transactional email ${field}: control characters are not allowed.`);
    }
  }
  if (
    !message.from.trim() ||
    !message.recipient.trim() ||
    !message.subject.trim() ||
    !message.idempotencyKey.trim() ||
    message.idempotencyKey.length > 256
  ) {
    throw new Error("Invalid transactional email: required fields are empty or too long.");
  }
  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(message.recipient)) {
    throw new Error("Invalid transactional email recipient.");
  }
  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(message.replyTo ?? message.recipient)) {
    throw new Error("Invalid transactional email reply address.");
  }
  // No attachments are supported by this transport; cap accidental huge renders
  // before a network request to avoid exhausting request throughput.
  if (message.html.length > 1_048_576 || message.text.length > 1_048_576) {
    throw new Error("Transactional email body is too large.");
  }
}

export async function deliverViaResend(message: ResendTransactionalMessage): Promise<void> {
  validateMessage(message);
  const body = JSON.stringify({
    from: message.from,
    to: [message.recipient],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${message.key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return;
    // Invalid configuration, blocked recipients and bad API requests must
    // never be retried automatically.
    if (attempt === 1 || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`Transactional email failed (Resend HTTP ${response.status}).`);
    }
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    const waitMs = Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 2000) : 500;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
}
