type Environment = Record<string, string | undefined>;

/** Check readiness without disclosing keys, URLs, provider responses or account data. */
export async function checkBackendHealth(env: Environment, fetcher: typeof fetch = fetch) {
  const configured = Boolean(env["SUPABASE_URL"] && env["SUPABASE_PUBLISHABLE_KEY"]);
  let authReachable = false;
  let serverCredentialsValid = false;
  let databaseReachable = false;
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
  const privateKey = env["SUPABASE_SERVICE_ROLE_KEY"];
  if (configured && authReachable && privateKey) {
    const headers: Record<string, string> = { apikey: privateKey };
    // Legacy service-role keys are JWTs; current sb_secret_ keys use apikey only.
    if (privateKey.startsWith("eyJ")) headers["Authorization"] = `Bearer ${privateKey}`;
    try {
      const response = await fetcher(
        `${env["SUPABASE_URL"]}/auth/v1/admin/users?per_page=1&page=1`,
        {
          headers,
          signal: AbortSignal.timeout(5_000),
          cache: "no-store",
        },
      );
      const payload = response.ok ? ((await response.json()) as { users?: unknown }) : null;
      serverCredentialsValid = Boolean(payload && Array.isArray(payload.users));
      // Discard the admin response; never expose account records in this endpoint.
      if (serverCredentialsValid) {
        const database = await fetcher(
          `${env["SUPABASE_URL"]}/rest/v1/competitions?select=id&limit=1`,
          {
            headers,
            signal: AbortSignal.timeout(5_000),
            cache: "no-store",
          },
        );
        databaseReachable = database.ok && Array.isArray(await database.json());
      }
    } catch {
      databaseReachable = false;
    }
  }
  const ready = configured && authReachable && serverCredentialsValid && databaseReachable;
  return {
    status: ready ? "ready" : "degraded",
    checks: {
      auth: authReachable,
      serverCredentials: serverCredentialsValid,
      database: databaseReachable,
    },
  } as const;
}
