import "@tanstack/react-start/server-only";
import { validateEmailAddress } from "./email-templates/send-email-url";

/** Existing provider workflows, not a claim that every published template is wired. */
export const EMAIL_AUTOMATION_EVENTS = {
  "user.created": "pfm3d-boas-vindas-premium",
  "onboarding.guides_requested": "pfm3d-getting-started",
  "career.backup_alert": "pfm3d-save-safety",
  "purchase.fulfilled": "pfm3d-purchase-fulfilled",
  "account.security_alert": "pfm3d-security-alert",
} as const;

type AutomationEvent = keyof typeof EMAIL_AUTOMATION_EVENTS;
export interface EmailAutomationLease {
  id: string;
  leaseToken: string;
  event: AutomationEvent;
  userId: string;
  sourceId: string;
  recipient: string;
  payload: Record<string, string>;
  attempt: number;
}

export type EmailAutomationOutcome = {
  outcome: "sent" | "retry" | "dead" | "uncertain";
  httpStatus: number | null;
  retryAfterSeconds: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESEND_EVENTS_URL = "https://api.resend.com/events/send";

export function validEmailAutomationKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 1_000 &&
    value.trim() === value &&
    !/\s/.test(value) &&
    !Array.from(value).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validate the service-only RPC boundary as well as the database CHECK constraints. */
export function parseEmailAutomationLease(value: unknown): EmailAutomationLease {
  if (!record(value)) throw new Error("Invalid email automation lease.");
  const { id, lease_token, event_name, user_id, source_id, recipient_email, payload, attempts } =
    value;
  if (
    typeof id !== "string" ||
    !UUID.test(id) ||
    typeof lease_token !== "string" ||
    !UUID.test(lease_token) ||
    typeof user_id !== "string" ||
    !UUID.test(user_id) ||
    typeof source_id !== "string" ||
    !UUID.test(source_id) ||
    typeof event_name !== "string" ||
    !Object.hasOwn(EMAIL_AUTOMATION_EVENTS, event_name) ||
    !record(payload) ||
    typeof attempts !== "number" ||
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 6
  ) {
    throw new Error("Invalid email automation lease.");
  }
  const event = event_name as AutomationEvent;
  if (event === "user.created" && source_id !== user_id) {
    throw new Error("Invalid signup automation source.");
  }
  const extraKey =
    event === "purchase.fulfilled"
      ? "order_id"
      : event === "career.backup_alert"
        ? "career_id"
        : event === "account.security_alert"
          ? "security_event_id"
          : "locale";
  const expectedExtra = extraKey === "locale" ? "pt-BR" : source_id;
  if (
    Object.keys(payload).length !== 2 ||
    payload["user_id"] !== user_id ||
    payload[extraKey] !== expectedExtra
  ) {
    throw new Error("Invalid email automation payload.");
  }
  const recipient = validateEmailAddress(recipient_email, "Automation recipient");
  if (recipient !== recipient_email) throw new Error("Invalid email automation recipient.");
  return {
    id,
    leaseToken: lease_token,
    event,
    userId: user_id,
    sourceId: source_id,
    recipient,
    payload: { user_id, [extraKey]: expectedExtra },
    attempt: attempts,
  };
}

function retryAfterSeconds(header: string | null): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(86_400, Math.ceil(seconds));
  const date = Date.parse(header);
  return Number.isFinite(date)
    ? Math.min(86_400, Math.max(0, Math.ceil((date - Date.now()) / 1_000)))
    : 0;
}

/**
 * /events/send does not document provider idempotency support. The stable
 * header is defense in depth, NOT an exactly-once guarantee. Only an explicit
 * 429 is automatically retried; timeout, 5xx and unexpected success responses
 * are quarantined for reconciliation rather than risking a second automation.
 */
export async function deliverEmailAutomationEvent(
  lease: EmailAutomationLease,
  key: string,
): Promise<EmailAutomationOutcome> {
  if (!validEmailAutomationKey(key)) {
    throw new Error("Invalid email automation provider configuration.");
  }
  let response: Response;
  try {
    response = await fetch(RESEND_EVENTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "idempotency-key": `jgm-automation/${lease.id}`,
      },
      body: JSON.stringify({ event: lease.event, email: lease.recipient, payload: lease.payload }),
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { outcome: "uncertain", httpStatus: null, retryAfterSeconds: 0 };
  }
  const status = response.status;
  const delay = status === 429 ? retryAfterSeconds(response.headers.get("retry-after")) : 0;
  // Never store or return provider bodies: they can contain personal data.
  await response.body?.cancel().catch(() => undefined);
  return {
    outcome:
      status === 202
        ? "sent"
        : status === 429
          ? "retry"
          : status >= 400 && status < 500
            ? "dead"
            : "uncertain",
    httpStatus: status,
    retryAfterSeconds: delay,
  };
}
