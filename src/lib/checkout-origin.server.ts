import { PUBLISHED_BASE_URL } from "@/lib/site-host";
import { PublicPaymentError } from "./payment-errors";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Checkout and billing returns must stay on a deployment-configured origin.
 * In local development only, localhost can use its current port. This avoids
 * turning an untrusted Host header into a Stripe redirect destination.
 */
export function getTrustedCheckoutOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const callerOrigin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (callerOrigin !== null && callerOrigin !== requestUrl.origin)
  ) {
    throw new PublicPaymentError("invalid_origin");
  }
  if (import.meta.env.DEV && LOCAL_HOSTS.has(requestUrl.hostname.toLowerCase())) {
    return requestUrl.origin;
  }

  const configuredSite = process.env["SITE_URL"]?.trim() || PUBLISHED_BASE_URL;
  let configuredUrl: URL;
  try {
    configuredUrl = new URL(configuredSite);
  } catch {
    throw new Error("SITE_URL precisa ser uma URL válida para liberar pagamentos.");
  }

  if (
    configuredUrl.protocol !== "https:" ||
    configuredUrl.username ||
    configuredUrl.password ||
    configuredUrl.pathname !== "/" ||
    configuredUrl.search ||
    configuredUrl.hash
  ) {
    throw new Error("SITE_URL precisa apontar para a origem HTTPS oficial do jogo.");
  }

  if (requestUrl.origin !== configuredUrl.origin) {
    throw new PublicPaymentError("invalid_origin");
  }

  return configuredUrl.origin;
}

/** Validate and serialize once before sending a browser-supplied return to Stripe. */
export function validateCheckoutReturnUrl(
  request: Request,
  value: string,
  requiredPath?: string,
): string {
  const origin = getTrustedCheckoutOrigin(request);
  if (
    value.length > 2048 ||
    value.includes("\\") ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32)
  )
    throw new PublicPaymentError("invalid_return");
  const url = new URL(value);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    (requiredPath !== undefined && url.pathname !== requiredPath)
  ) {
    throw new PublicPaymentError("invalid_return");
  }
  // Keep Stripe's literal placeholder; URL serialization percent-encodes braces.
  return url.toString().replaceAll("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}");
}
