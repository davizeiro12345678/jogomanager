import { PublicPaymentError } from "./payment-errors";
import { emitSecurityEvent } from "./security-events.server";

export type CheckoutFraudAction = "guest_checkout" | "account_checkout";
const ASSESSMENT_TIMEOUT_MS = 2_500;

type FraudDefenseMode = "off" | "observe" | "enforce";

interface AssessmentResponse {
  tokenProperties?: {
    valid?: boolean;
    action?: string;
    hostname?: string;
    invalidReason?: string;
  };
  riskAnalysis?: { score?: number; reasons?: string[] };
}

function mode(): FraudDefenseMode {
  const configured = process.env["GOOGLE_FRAUD_DEFENSE_MODE"]?.trim().toLowerCase();
  if (!configured || configured === "off") return "off";
  if (configured === "observe" || configured === "enforce") return configured;
  console.error(JSON.stringify({ security_event: "google_fraud_defense", result: "invalid_mode" }));
  throw new PublicPaymentError("fraud_check_failed");
}

function configuredCredentials() {
  const projectId = process.env["GOOGLE_CLOUD_PROJECT_ID"]?.trim();
  const siteKey = process.env["GOOGLE_RECAPTCHA_SITE_KEY"]?.trim();
  const apiKey = process.env["GOOGLE_RECAPTCHA_API_KEY"]?.trim();
  return projectId && siteKey && apiKey ? { projectId, siteKey, apiKey } : null;
}

function minimumScore(): number {
  const value = Number(process.env["GOOGLE_FRAUD_DEFENSE_MIN_SCORE"] ?? "0.5");
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.5;
}

function emitEvent(
  action: CheckoutFraudAction,
  policy: FraudDefenseMode,
  result:
    "disabled" | "allowed" | "observed_risk" | "rejected" | "provider_error" | "not_configured",
  score?: number,
  reason?: string,
) {
  // Keep this log free of tokens, email addresses, IPs, and assessment payloads.
  emitSecurityEvent({
    security_event: "google_fraud_defense",
    action,
    policy,
    result,
    ...(typeof score === "number"
      ? { scoreBucket: score < 0.3 ? "low" : score < 0.7 ? "medium" : "high" }
      : {}),
    ...(reason ? { reason } : {}),
  });
}

/**
 * Assesses only the checkout action. `observe` records a bounded result and
 * keeps checkout available; `enforce` rejects missing, invalid, risky, or
 * unavailable assessments. Google credentials stay on the server.
 */
export async function assessGuestCheckoutFraudDefense(
  token: unknown,
  request: Request,
): Promise<void> {
  return assessCheckoutFraudDefense(token, request, "guest_checkout");
}

/** Server-selected actions prevent using a guest token for an account purchase. */
export async function assessAccountCheckoutFraudDefense(
  token: unknown,
  request: Request,
): Promise<void> {
  return assessCheckoutFraudDefense(token, request, "account_checkout");
}

async function assessCheckoutFraudDefense(
  token: unknown,
  request: Request,
  action: CheckoutFraudAction,
): Promise<void> {
  const policy = mode();
  if (policy === "off") return;

  const credentials = configuredCredentials();
  if (!credentials) {
    emitEvent(action, policy, "not_configured");
    if (policy === "enforce") throw new PublicPaymentError("fraud_check_failed");
    return;
  }

  if (typeof token !== "string" || token.length < 20 || token.length > 16_384) {
    emitEvent(
      action,
      policy,
      policy === "enforce" ? "rejected" : "observed_risk",
      undefined,
      "missing_or_malformed_token",
    );
    if (policy === "enforce") throw new PublicPaymentError("fraud_check_failed");
    return;
  }

  const endpoint = new URL(
    `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(credentials.projectId)}/assessments`,
  );

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": credentials.apiKey },
      signal: AbortSignal.timeout(ASSESSMENT_TIMEOUT_MS),
      body: JSON.stringify({
        event: {
          token,
          siteKey: credentials.siteKey,
          expectedAction: action,
        },
      }),
    });
  } catch {
    emitEvent(action, policy, "provider_error", undefined, "request_failed");
    if (policy === "enforce") throw new PublicPaymentError("fraud_check_failed");
    return;
  }

  if (!response.ok) {
    emitEvent(action, policy, "provider_error", undefined, `http_${response.status}`);
    if (policy === "enforce") throw new PublicPaymentError("fraud_check_failed");
    return;
  }

  let assessment: AssessmentResponse;
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Invalid assessment payload");
    }
    assessment = payload as AssessmentResponse;
  } catch {
    emitEvent(action, policy, "provider_error", undefined, "invalid_response");
    if (policy === "enforce") throw new PublicPaymentError("fraud_check_failed");
    return;
  }

  const properties = assessment.tokenProperties;
  const hostnameMatches =
    typeof properties?.hostname === "string" &&
    properties.hostname.toLowerCase() === new URL(request.url).hostname.toLowerCase();
  const valid = properties?.valid === true && properties.action === action && hostnameMatches;
  const score = assessment.riskAnalysis?.score;
  const safeScore =
    typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1 ? score : null;
  const passesScore = safeScore !== null && safeScore >= minimumScore();

  if (!valid || !passesScore) {
    emitEvent(
      action,
      policy,
      policy === "enforce" ? "rejected" : "observed_risk",
      safeScore ?? undefined,
      !valid ? "invalid_token_action_or_host" : "below_minimum_score",
    );
    if (policy === "enforce") throw new PublicPaymentError("fraud_check_failed");
    return;
  }

  emitEvent(action, policy, "allowed", safeScore ?? undefined);
}
