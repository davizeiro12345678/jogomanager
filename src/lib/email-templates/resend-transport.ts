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

export async function deliverViaResend(message: ResendTransactionalMessage): Promise<void> {
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
      response = await fetch("https://api.resend.com/emails", {
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
      // A transport disconnect may happen after the provider accepted the
      // message. Retry once, using the exact same idempotency key and body.
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
    const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    const waitMs = Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 2000) : 500;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
  }
}
