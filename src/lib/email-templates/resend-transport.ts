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

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
const ADDRESS_SHAPE =
  /^[^\s@<>"(),;:\\[\].]+(\.[^\s@<>"(),;:\\[\].]+)*@[^\s@<>"(),;:\\[\].]+(\.[^\s@<>"(),;:\\[\].]+)*$/;

function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function assertEmailAddress(value: string, field: string): void {
  if (!value || value.trim() !== value || hasControlCharacters(value)) {
    throw new Error(
      `Invalid ${field}: control characters or surrounding whitespace are not allowed.`,
    );
  }

  const address = /^.*<([^<>]+)>$/.exec(value)?.[1] ?? value;
  if (!ADDRESS_SHAPE.test(address)) {
    throw new Error(`Invalid ${field}.`);
  }
}

function retryDelayMs(retryAfter: string | null): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 2000);

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.min(Math.max(0, retryAt - Date.now()), 2000);
  }
  return 500;
}

export async function deliverViaResend(message: ResendTransactionalMessage): Promise<void> {
  if (!message.key || hasControlCharacters(message.key)) {
    throw new Error("Invalid Resend API key configuration.");
  }
  assertEmailAddress(message.from, "sender");
  assertEmailAddress(message.recipient, "recipient");
  if (message.replyTo !== undefined) assertEmailAddress(message.replyTo, "reply-to");
  if (
    !message.idempotencyKey ||
    message.idempotencyKey.trim() !== message.idempotencyKey ||
    hasControlCharacters(message.idempotencyKey) ||
    message.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    throw new Error("Invalid email idempotency key.");
  }

  const body = JSON.stringify({
    from: message.from,
    to: [message.recipient],
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.replyTo ? { reply_to: message.replyTo } : {}),
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${message.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": message.idempotencyKey,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      // A timeout or connection reset can happen after the provider accepted the
      // request. Retry once with the same payload and idempotency key.
      if (attempt === 1) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      continue;
    }
    if (response.ok) return;
    // Invalid configuration, blocked recipients and bad API requests must
    // never be retried automatically.
    if (attempt === 1 || ![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`Transactional email failed (Resend HTTP ${response.status}).`);
    }
    const retryAfter = response.headers.get("retry-after");
    await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs(retryAfter)));
  }
}
