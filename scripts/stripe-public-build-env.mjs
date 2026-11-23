import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Cloudflare Worker runtime keeps a publicly distributable Stripe key. Copy
 * only that known plain-text binding into the GitHub Vite *build* environment.
 * Private Stripe API and webhook secrets must never be returned by this tool.
 */
export function assertStripePublicBuildKey(value, environment = "live") {
  if (!["live", "sandbox"].includes(environment))
    throw new Error("Unsupported payment environment");
  const prefix = environment === "live" ? "pk_live_" : "pk_test_";
  if (
    typeof value !== "string" ||
    !value.startsWith(prefix) ||
    !/^pk_(?:live|test)_[A-Za-z0-9]{8,220}$/.test(value)
  )
    throw new Error("The Stripe publishable key is missing or does not match the build environment");
  return value;
}

export async function resolveStripePublicBuildKey({
  token,
  accountId,
  environment = "live",
  fetchImpl = fetch,
}) {
  if (!token || !accountId) throw new Error("Cloudflare token and account ID are required");
  if (!["live", "sandbox"].includes(environment)) throw new Error("Unsupported payment environment");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/workers/scripts/jogomanager-web/settings`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Could not read Cloudflare Worker public bindings (HTTP ${response.status})`);
  const data = await response.json();
  if (data?.success !== true || !Array.isArray(data?.result?.bindings))
    throw new Error("Unrecognized Cloudflare Worker settings response");
  const binding = data.result.bindings.find((item) => item.name === "VITE_PAYMENTS_CLIENT_TOKEN");
  if (binding?.type !== "plain_text")
    throw new Error("The public Stripe binding must be present as a plain-text Worker variable");
  return assertStripePublicBuildKey(binding.text, environment);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const value = await resolveStripePublicBuildKey({
      token: process.env["CLOUDFLARE_API_TOKEN"],
      accountId: process.env["CLOUDFLARE_ACCOUNT_ID"],
      environment: process.env["PAYMENTS_ENVIRONMENT"] || "live",
    });
    const file = process.env["GITHUB_ENV"];
    if (!file) throw new Error("GITHUB_ENV is required for production workflow");
    appendFileSync(file, `VITE_PAYMENTS_CLIENT_TOKEN=${value}\n`, { mode: 0o600 });
    console.log("Validated Stripe public build key for the production Worker.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Stripe public build-key validation failed");
    process.exitCode = 1;
  }
}
