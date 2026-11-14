import type { SocialProvider } from "./social-auth";

type OAuthResult = { error?: unknown; redirected?: boolean };

/** Public flags enable only providers whose own credentials were configured. */
export function directOAuthProviders(value: unknown): string[] {
  return typeof value === "string"
    ? [
        ...new Set(
          value
            .split(",")
            .map((provider) => provider.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

export function isOAuthBrokerUnavailable(error: unknown): boolean {
  if (error instanceof TypeError)
    return /fetch|network|load failed|failed to load|importing a module/i.test(error.message);
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const status = record["status"];
  if (status === 402 || (typeof status === "number" && status >= 500 && status <= 599)) return true;
  return [
    "insufficient_credits",
    "credits_exhausted",
    "service_unavailable",
    "network_error",
  ].includes(typeof record["code"] === "string" ? record["code"] : "");
}

/**
 * Recover only a broker outage. Both paths must use the application's existing
 * Supabase project; cancellation, account errors and rate limits stay errors.
 */
export async function signInWithOAuthRecovery({
  provider,
  useBroker,
  directProviders,
  broker,
  direct,
}: {
  provider: SocialProvider;
  useBroker: boolean;
  directProviders: readonly string[];
  broker: () => Promise<OAuthResult>;
  direct: () => Promise<OAuthResult>;
}): Promise<{ path: "broker" | "direct"; redirected: boolean; recovered: boolean }> {
  if (!useBroker) {
    const result = await direct();
    if (result.error) throw result.error;
    return { path: "direct", redirected: true, recovered: false };
  }
  let result: OAuthResult;
  try {
    result = await broker();
    // A redirect has already transferred control. Never start a competing flow.
    if (result.redirected) return { path: "broker", redirected: true, recovered: false };
    if (result.error) throw result.error;
    return { path: "broker", redirected: false, recovered: false };
  } catch (error) {
    if (!directProviders.includes(provider) || !isOAuthBrokerUnavailable(error)) throw error;
  }
  result = await direct();
  if (result.error) throw result.error;
  return { path: "direct", redirected: true, recovered: true };
}
