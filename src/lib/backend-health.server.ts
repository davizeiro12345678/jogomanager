type Environment = Record<string, string | undefined>;

/** Check readiness without disclosing keys, URLs, provider responses or account data. */
export async function checkBackendHealth(env: Environment, fetcher: typeof fetch = fetch) {
  const configured = Boolean(env["SUPABASE_URL"] && env["SUPABASE_PUBLISHABLE_KEY"]);
  let authReachable = false;
  if (configured) {
    try {
      const response = await fetcher(`${env["SUPABASE_URL"]}/auth/v1/settings`, {
        headers: { apikey: env["SUPABASE_PUBLISHABLE_KEY"]! },
        signal: AbortSignal.timeout(5_000),
        cache: "no-store",
      });
      const settings = response.ok ? ((await response.json()) as { external?: unknown }) : null;
      authReachable = Boolean(
        settings && typeof settings.external === "object" && settings.external !== null,
      );
    } catch {
      authReachable = false;
    }
  }
  const ready = configured && authReachable && Boolean(env["SUPABASE_SERVICE_ROLE_KEY"]);
  return {
    status: ready ? "ready" : "degraded",
    checks: { auth: authReachable, serverCredentials: Boolean(env["SUPABASE_SERVICE_ROLE_KEY"]) },
  } as const;
}
