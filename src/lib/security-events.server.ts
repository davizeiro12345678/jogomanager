import { securityEvent, type SecurityEventType } from "./security-event";

/** Bounded per-isolate event budgets. Export happens through a log collector;
 * security providers never extend checkout/match request latency. */
const budgets = new Map<SecurityEventType, { start: number; used: number; suppressed: number }>();
export function emitSecurityEvent(input: unknown): void {
  const event = securityEvent(input);
  if (!event) return;
  const now = Date.now();
  let budget = budgets.get(event.security_event);
  if (!budget || now - budget.start >= 60_000 || now < budget.start) {
    const suppressed = budget?.suppressed ?? 0;
    budget = { start: now, used: 0, suppressed: 0 };
    budgets.set(event.security_event, budget);
    if (suppressed)
      console.info(
        JSON.stringify({
          security_event: "security_log_sampling",
          schemaVersion: 1,
          timestamp: event.timestamp,
          category: event.security_event,
          suppressed,
        }),
      );
  }
  if (budget.used >= 60) {
    budget.suppressed++;
    return;
  }
  budget.used++;
  console.info(JSON.stringify(event));
}

export function auditSecurityResponse(status: number): void {
  if (status === 401 || status === 403)
    emitSecurityEvent({ security_event: "http_access_denied", result: "rejected", status });
  else if (status === 429)
    emitSecurityEvent({ security_event: "http_rate_limited", result: "rejected", status });
  else if (status >= 500)
    emitSecurityEvent({ security_event: "http_server_error", result: "provider_error", status });
}
