export function validateFootballPage(body, job) {
  if (!body || typeof body !== "object" || (body.errors && Object.keys(body.errors).length))
    throw new Error("provider_reported_error");
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
  return body;
}

// Commit the validated provider response before any catalog writes. A new
// lease can reuse it after interruption, while each attempted request is
// reserved and counted atomically on its durable job.
export async function loadFootballJobPage(job, { rpc, beforeRequest, requestPage }) {
  if (job.cached_body) return validateFootballPage(job.cached_body, job);
  await beforeRequest();
  const lease = { p_path: job.path, p_lease: job.lease_token };
  await rpc("football_queue_reserve_job", lease);
  const page = validateFootballPage(await requestPage(), job);
  await rpc("football_queue_cache_page", { ...lease, p_body: page });
  return page;
}

export function footballErrorCode(error) {
  const value = error instanceof Error ? error.message : "unknown_error";
  return /^(football_(daily_|minute_)?quota_wait|provider_(rate_wait|daily_quota|http_[0-9]{3}|reported_error|invalid_list|page_mismatch)|window_budget|database_[A-Za-z0-9_]+|invalid_provider_path)$/.test(
    value,
  )
    ? value
    : "provider_or_materialization_failed";
}
