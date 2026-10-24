const EVENT_TYPES = [
  "google_fraud_defense",
  "http_access_denied",
  "http_rate_limited",
  "http_server_error",
] as const;
const RESULTS = [
  "disabled",
  "allowed",
  "observed_risk",
  "rejected",
  "provider_error",
  "not_configured",
] as const;
const REASONS = new Set([
  "missing_or_malformed_token",
  "request_failed",
  "invalid_response",
  "invalid_token_action_or_host",
  "below_minimum_score",
  "invalid_mode",
]);
export type SecurityEventType = (typeof EVENT_TYPES)[number];
export interface SecurityEvent {
  schemaVersion: 1;
  timestamp: string;
  security_event: SecurityEventType;
  result: (typeof RESULTS)[number];
  action?: "guest_checkout" | "account_checkout";
  policy?: "off" | "observe" | "enforce";
  scoreBucket?: "low" | "medium" | "high";
  reason?: string;
  status?: number;
}
const object = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));

/** An allowlist projection, not a generic log redactor. Unknown fields and
 * free-form provider text never reach the security feed. */
export function securityEvent(value: unknown, now = new Date()): SecurityEvent | null {
  if (
    !object(value) ||
    !EVENT_TYPES.includes(value["security_event"] as SecurityEventType) ||
    !RESULTS.includes(value["result"] as SecurityEvent["result"])
  )
    return null;
  const event: SecurityEvent = {
    schemaVersion: 1,
    timestamp: now.toISOString(),
    security_event: value["security_event"] as SecurityEventType,
    result: value["result"] as SecurityEvent["result"],
  };
  if (value["action"] === "guest_checkout" || value["action"] === "account_checkout")
    event.action = value["action"];
  if (["off", "observe", "enforce"].includes(String(value["policy"])))
    event.policy = value["policy"] as NonNullable<SecurityEvent["policy"]>;
  if (["low", "medium", "high"].includes(String(value["scoreBucket"])))
    event.scoreBucket = value["scoreBucket"] as NonNullable<SecurityEvent["scoreBucket"]>;
  const reason = value["reason"];
  if (typeof reason === "string" && (REASONS.has(reason) || /^http_[45]\d\d$/.test(reason)))
    event.reason = reason;
  const status = value["status"];
  if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599)
    event.status = status;
  return event;
}

/** Modern Chronicle ImportEvents inline source. This projection contains no
 * account IDs, tokens, IP addresses, request paths, saves or purchase data. */
export function googleSecOpsBatch(events: readonly SecurityEvent[]) {
  if (!events.length || events.length > 100)
    throw new Error("Security batches require 1 to 100 events.");
  return {
    inlineSource: {
      events: events.map((input) => {
        const timestamp = new Date(input.timestamp);
        if (!Number.isFinite(timestamp.getTime())) throw new Error("Invalid security timestamp.");
        const event = securityEvent(input, timestamp);
        if (!event) throw new Error("Invalid security event.");
        return {
          udm: {
            metadata: {
              eventTimestamp: event.timestamp,
              eventType: "GENERIC_EVENT",
              vendorName: "JogoManager",
              productName: "JogoManager Worker",
              productEventType: event.security_event,
            },
            principal: { hostname: "jogomanager-worker" },
            target: { application: "JogoManager" },
            securityResult: [
              {
                action:
                  event.result === "rejected"
                    ? ["BLOCK"]
                    : event.result === "provider_error"
                      ? ["UNKNOWN_ACTION"]
                      : ["ALLOW"],
                severity:
                  event.result === "provider_error" ||
                  event.result === "rejected" ||
                  event.result === "observed_risk"
                    ? "MEDIUM"
                    : "INFORMATIONAL",
                ruleName: event.security_event,
                summary: [
                  event.result,
                  event.action,
                  event.policy,
                  event.reason,
                  event.scoreBucket,
                  event.status,
                ]
                  .filter((v) => v !== undefined)
                  .join(" / "),
              },
            ],
          },
        };
      }),
    },
  };
}
