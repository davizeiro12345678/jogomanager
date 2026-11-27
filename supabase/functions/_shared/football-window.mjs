// The database enforces global quotas; these limits bound each invocation.
export function footballWindowBudget(configuredLanes, pilot) {
  const parsed = Number(configuredLanes);
  const lanes = pilot || !Number.isInteger(parsed) || parsed < 1 ? 1 : Math.min(12, parsed);
  return {
    lanes,
    // The Edge runtime previously hit WORKER_RESOURCE_LIMIT at 48 concurrent
    // claims. Keep the durable DB lease capacity at 48, but cap each invocation
    // to 12 lanes and 120 requests; the shared fetch clock still enforces 9/s.
    spacingMs: Math.max(110, Math.ceil(800 / lanes)),
    maxRequests: Math.min(120, lanes * 15),
  };
}

export const MAX_RETRY_AFTER_MS = 8_000;
const HTTP_DATE =
  /^(?:[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT|[A-Z][a-z]+, \d{2}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}:\d{2} GMT|[A-Z][a-z]{2} [A-Z][a-z]{2} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4})$/;

// Keep Retry-After bounded: a provider must not be able to hold a worker
// indefinitely, and an injected clock keeps HTTP-date cases deterministic.
export function parseRetryAfterMs(value, nowMs, maxMs = MAX_RETRY_AFTER_MS) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  const limit = Number.isFinite(maxMs) && maxMs >= 0 ? Math.floor(maxMs) : MAX_RETRY_AFTER_MS;
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    if (!Number.isFinite(seconds)) return limit;
    return Math.min(seconds * 1_000, limit);
  }

  if (!Number.isFinite(nowMs)) return null;
  if (!HTTP_DATE.test(raw)) return null;
  const timestamp = Date.parse(raw.includes(" GMT") ? raw : `${raw} GMT`);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(0, timestamp - nowMs), limit);
}

export function footballProviderRetryAfterMs(response, nowMs) {
  return parseRetryAfterMs(response.headers.get("retry-after"), nowMs);
}

export function footballProviderRateError(response) {
  if (response.status !== 429) return null;
  return response.headers.get("x-ratelimit-requests-remaining")?.trim() === "0"
    ? "provider_daily_quota"
    : "provider_rate_wait";
}

export function validateFootballPage(body, job) {
  if (!body || typeof body !== "object") throw new Error("provider_reported_error");
  if (body.errors && Object.keys(body.errors).length) {
    const errors = body.errors;
    if (Object.hasOwn(errors, "rateLimit")) throw new Error("provider_rate_wait");
    if (typeof errors.requests === "string" && /daily|per day|per-day/i.test(errors.requests))
      throw new Error("provider_daily_quota");
    const kind = ["token", "plan", "requests", "parameters", "time", "query", "subscription"].find(
      (key) => Object.hasOwn(errors, key),
    );
    // Retain only a known category, never a provider-supplied message or data.
    throw new Error(kind ? `provider_reported_error_${kind}` : "provider_reported_error");
  }
  if (
    !Array.isArray(body.response) &&
    !(job.kind === "team_stats" && body.response && typeof body.response === "object")
  )
    throw new Error("provider_invalid_list");
  const expected = Number(
    new URL(job.path, "https://provider.invalid").searchParams.get("page") ?? 1,
  );
  if (
    body.paging &&
    (!Number.isSafeInteger(body.paging.current) ||
      !Number.isSafeInteger(body.paging.total) ||
      body.paging.current !== expected ||
      body.paging.total < expected)
  )
    throw new Error("provider_page_mismatch");
  if (job.kind === "fixtures" || job.kind === "fixture_detail") {
    const parameters = new URL(job.path, "https://provider.invalid").searchParams;
    const league = parameters.get("league");
    const season = parameters.get("season");
    const requestedIds = new Set(parameters.get("ids")?.split("-") ?? []);
    const validRows = new Map();
    const validId = (value) => Number.isSafeInteger(value) && value > 0;
    for (const row of body.response) {
      const id = row?.fixture?.id;
      const home = row?.teams?.home?.id;
      const away = row?.teams?.away?.id;
      if (
        !validId(id) ||
        (league !== null && String(row.league?.id) !== league) ||
        (season !== null && String(row.league?.season) !== season) ||
        (requestedIds.size > 0 && !requestedIds.has(String(id)))
      )
        throw new Error("provider_invalid_fixture");
      // Upcoming fixtures can contain placeholders. Keep the valid entries
      // and deduplicate repeated provider IDs before materialization.
      if (validId(home) && validId(away) && home !== away) validRows.set(id, row);
    }
    return { ...body, response: [...validRows.values()] };
  }
  return body;
}

// Commit the validated provider response before any catalog writes. A new
// lease can reuse it after interruption, while each attempted request is
// reserved and counted atomically on its durable job.
export async function loadFootballJobPage(
  job,
  {
    rpc,
    beforeRequest,
    requestPage,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
) {
  if (job.cached_body) return validateFootballPage(job.cached_body, job);
  const lease = { p_path: job.path, p_lease: job.lease_token };
  let quotaWaitMs = 1_000;
  while (true) {
    // Recheck the invocation deadline and pace every attempt. A rejected
    // reservation never reaches the provider or consumes a daily token.
    await beforeRequest();
    try {
      await rpc("football_queue_reserve_job", lease);
      break;
    } catch (error) {
      if (!error || typeof error !== "object" || error.message !== "football_minute_quota_wait")
        throw error;
      await wait(quotaWaitMs);
      quotaWaitMs = Math.min(quotaWaitMs * 2, 5_000);
    }
  }
  const page = validateFootballPage(await requestPage(), job);
  await rpc("football_queue_cache_page", { ...lease, p_body: page });
  return page;
}

export function footballErrorCode(error) {
  const value =
    error && typeof error === "object" && typeof error.message === "string"
      ? error.message
      : "unknown_error";
  return /^(football_(daily_|minute_)?quota_wait|provider_(rate_wait|daily_quota|http_[0-9]{3}|reported_error(?:_(?:token|plan|requests|parameters|time|query|subscription))?|invalid_list|page_mismatch|invalid_fixture)|window_budget|database_[A-Za-z0-9_]+|invalid_provider_path)$/.test(
    value,
  )
    ? value
    : "provider_or_materialization_failed";
}
