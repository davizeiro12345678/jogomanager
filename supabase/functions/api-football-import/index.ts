// Scheduled sports-only import. The body authenticates both cron and admin;
// neither the queue nor the provider key is available to browser clients.
import { createClient } from "npm:@supabase/supabase-js@2.101.0";
import { createFootballMaterializer } from "../_shared/football-materialize.mjs";
import {
  footballErrorCode,
  footballProviderRateError,
  footballWindowBudget,
  loadFootballJobPage,
} from "../_shared/football-window.mjs";

const hash = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const reply = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
const client = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const adminToken = request.headers.get("x-football-admin");
  const token = adminToken ?? request.headers.get("x-football-worker") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return reply(401, { error: "unauthorized" });
  const db = client();
  const rpc = async (name: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await db.rpc(name, args);
    if (error)
      throw new Error(error.message?.includes("quota") ? error.message : "database_" + error.code);
    return data;
  };
  try {
    const settings = await rpc("football_queue_settings", {
      p_hash: await hash(token),
      p_admin: !!adminToken,
    });
    if (!settings) return reply(401, { error: "unauthorized" });
    if (Number(request.headers.get("content-length")) > 14000000)
      return reply(413, { error: "payload_too_large" });
    const text = await request.text();
    if (text.length > 13000000) return reply(413, { error: "payload_too_large" });
    const body = JSON.parse(text);
    if (adminToken) {
      if (body.action === "status") return reply(200, await rpc("football_queue_status"));
      if (body.action === "seed")
        return reply(200, await rpc("football_queue_seed", { p_jobs: body.jobs }));
      if (body.action === "cache")
        return reply(
          200,
          await rpc("football_queue_cache", {
            p_path: body.path,
            p_text: body.text,
            p_hash: body.hash,
          }),
        );
      if (body.action === "activate")
        return reply(200, {
          enabled: await rpc("football_queue_activate", { p_enabled: body.enabled === true }),
        });
      if (body.action === "configure") {
        if (typeof body.key !== "string" || body.key.length < 20)
          return reply(400, { error: "invalid_provider_key" });
        const status = await fetch("https://v3.football.api-sports.io/status", {
          headers: { "x-apisports-key": body.key },
          signal: AbortSignal.timeout(15000),
        });
        const value = await status.json();
        const limit = Number(
          value.response?.requests?.limit_day ?? value.response?.requests?.limit,
        );
        if (
          !status.ok ||
          (value.errors && Object.keys(value.errors).length) ||
          !Number.isSafeInteger(limit) ||
          limit < 1
        )
          return reply(409, { error: "provider_status_unavailable" });
        return reply(
          200,
          await rpc("football_queue_configure", {
            p_key: body.key,
            p_url: Deno.env.get("SUPABASE_URL"),
            p_daily: limit,
            p_minute: Number(status.headers.get("x-ratelimit-limit")) || 450,
          }),
        );
      }
      if (body.action !== "pilot") return reply(400, { error: "invalid_admin_action" });
    } else if (body.action !== "run") return reply(400, { error: "invalid_action" });
    if (!settings.apiKey) return reply(409, { error: "queue_not_configured" });
    if (!adminToken && (!settings.enabled || Date.parse(settings.nextRunAt) > Date.now()))
      return reply(200, { paused: true });
    const deadline = Date.now() + 49000,
      summary = {
        completed: 0,
        failed: 0,
        deferred: 0,
        requests: 0,
        remaining: null as number | null,
        lanes: 0,
        spacingMs: 0,
        quotaWaits: 0,
        stopReason: null as string | null,
        providerMinuteLimit: null as number | null,
        providerMinuteRemaining: null as number | null,
        providerRateSource: null as string | null,
        providerErrorKeys: null as string[] | null,
        providerRateHint: null as string | null,
        providerRateAtMs: null as number | null,
        maxFetchPerSecond: 0,
        fetchRateDelayed: 0,
      };
    let stopped = false,
      nextRequest = Date.now(),
      nextProviderRequest = Date.now();
    const { lanes, spacingMs, maxRequests } = footballWindowBudget(
      Deno.env.get("FOOTBALL_IMPORT_LANES") ?? "48",
      !!adminToken,
    );
    summary.lanes = lanes;
    summary.spacingMs = spacingMs;
    let scheduledRequests = 0;
    const fetchSecondCounts = new Map<number, number>();
    const run = async () => {
      while (!stopped && Date.now() < deadline - 5000 && scheduledRequests < maxRequests) {
        const job = await rpc("football_queue_claim");
        if (!job) break;
        let jobRequests = 0;
        try {
          const page = await loadFootballJobPage(job, {
            // A full second can trigger transient database quota contention;
            // retry that reservation without making or counting a provider call.
            rpc: async (name: string, args: Record<string, unknown> = {}) => {
              if (name !== "football_queue_reserve_job") return rpc(name, args);
              for (let retry = 0;; retry++) {
                try {
                  return await rpc(name, args);
                } catch (error) {
                  const code = error instanceof Error ? error.message : "";
                  if (!code.includes("football_minute_quota_wait") ||
                      stopped || Date.now() >= deadline - 5000) throw error;
                  summary.quotaWaits++;
                  await new Promise((r) => setTimeout(r, Math.min(600, 180 + retry * 90)));
                }
              }
            },
            beforeRequest: async () => {
              if (!job.path.startsWith("/") || job.path.startsWith("//"))
                throw new Error("invalid_provider_path");
              // Keep the reservation pipeline full while capacity exists,
              // then drain it as the fetch deadline approaches to avoid
              // debiting quota for calls we cannot actually send.
              while (!stopped && Date.now() < deadline - 5000) {
                const slotsLeft = Math.floor((deadline - 5000 - Date.now()) / spacingMs);
                if (slotsLeft <= 0) throw new Error("window_budget");
                const safeInFlight = Math.max(1, Math.min(lanes, slotsLeft));
                if (scheduledRequests - summary.requests < safeInFlight) break;
                await new Promise((r) => setTimeout(r, 30));
              }
              const slot = Math.max(Date.now(), nextRequest);
              if (stopped || scheduledRequests >= maxRequests || slot > deadline - 5000)
                throw new Error("window_budget");
              nextRequest = slot + spacingMs;
              scheduledRequests++;
              await new Promise((r) => setTimeout(r, Math.max(0, slot - Date.now())));
              if (stopped || Date.now() > deadline - 5000) throw new Error("window_budget");
            },
            requestPage: async () => {
              // Reservation RPC latency can bunch calls despite reservation pacing.
              // Pace the actual provider fetch separately and in one shared lane clock.
              const providerSlot = Math.max(Date.now(), nextProviderRequest);
              if (stopped || providerSlot > deadline - 5000) throw new Error("window_budget");
              nextProviderRequest = providerSlot + spacingMs;
              await new Promise((r) => setTimeout(r, Math.max(0, providerSlot - Date.now())));
              if (stopped || Date.now() > deadline - 5000) throw new Error("window_budget");
              // Timers and database responses can coalesce; enforce an
              // actual outgoing-fetch rate, not only scheduled timing.
              // Nine starts/second leaves safety room beneath the observed
              // upstream rateLimit threshold, regardless of timer jitter.
              let fetchPermitted = false;
              while (!stopped && Date.now() < deadline - 5000) {
                const nowMs = Date.now();
                const fetchSecond = Math.floor(nowMs / 1000);
                const seen = fetchSecondCounts.get(fetchSecond) ?? 0;
                if (seen < 9) {
                  fetchSecondCounts.set(fetchSecond, seen + 1);
                  summary.maxFetchPerSecond = Math.max(summary.maxFetchPerSecond, seen + 1);
                  fetchPermitted = true;
                  break;
                }
                summary.fetchRateDelayed++;
                await new Promise((r) => setTimeout(r, 1001 - (nowMs % 1000)));
              }
              if (!fetchPermitted) throw new Error("window_budget");
              summary.requests++;
              jobRequests++;
              const response = await fetch("https://v3.football.api-sports.io" + job.path, {
                headers: { "x-apisports-key": settings.apiKey },
                signal: AbortSignal.timeout(
                  Math.max(1, Math.min(18000, deadline - Date.now() - 1500)),
                ),
              });
              const providerMinuteCap = response.headers.get("x-ratelimit-limit");
              if (providerMinuteCap !== null && Number.isFinite(Number(providerMinuteCap)))
                summary.providerMinuteLimit = Number(providerMinuteCap);
              const providerMinuteLeft = response.headers.get("x-ratelimit-remaining");
              if (providerMinuteLeft !== null && Number.isFinite(Number(providerMinuteLeft)))
                summary.providerMinuteRemaining = Math.min(
                  summary.providerMinuteRemaining ?? Infinity, Number(providerMinuteLeft),
                );
              const remaining = response.headers.get("x-ratelimit-requests-remaining");
              if (remaining !== null && Number.isFinite(Number(remaining)))
                summary.remaining = Math.min(summary.remaining ?? Infinity, Number(remaining));
              const rateError = footballProviderRateError(response);
              if (rateError) {
                summary.providerRateSource ??= "http_429";
                stopped = true;
                await response.body?.cancel();
                throw new Error(rateError);
              }
              if (!response.ok) {
                await response.body?.cancel();
                throw new Error("provider_http_" + response.status);
              }
              const body = await response.json();
              if (body?.errors && Object.keys(body.errors).some(
                (key: string) => /rate.?limit|quota|requests/i.test(key),
              )) {
                summary.providerRateSource ??= "body_errors";
                summary.providerErrorKeys ??= Object.keys(body.errors)
                  .filter((key: string) => /^[a-zA-Z]{1,30}$/.test(key)).slice(0, 4);
                const rateMessage = String(body.errors.rateLimit ?? "").toLowerCase();
                summary.providerRateHint ??= /minute/.test(rateMessage)
                  ? "minute" : /second/.test(rateMessage) ? "second" : "unspecified";
                summary.providerRateAtMs ??= Date.now() - (deadline - 49000);
              }
              return body;
            },
          });
          const ids =
            job.kind === "teams"
              ? page.response.map((x: { team: { id: string | number } }) => `af:${x.team.id}`)
              : job.meta.team
                ? [`af:${job.meta.team}`]
                : [];
          const teamMap = new Map();
          if (ids.length) {
            for (let offset = 0; offset < ids.length; offset += 200) {
              const { data, error } = await db
                .from("official_teams")
                .select("source_id,local_club_id,league_source_id")
                .in("source_id", ids.slice(offset, offset + 200));
              if (error) throw new Error("database_team_mapping");
              for (const row of data ?? []) teamMap.set(row.source_id, row);
            }
          }
          const writes: unknown[] = [],
            children: unknown[] = [];
          const materialize = createFootballMaterializer({
            teamMap,
            now: Date.parse(settings.cutoff),
            enrichVenues: async (venues: Record<string, unknown>[]) => {
              const result = await db.rpc("enrich_football_venues", { p_venues: venues });
              if (result.error) throw new Error("database_venue_enrichment");
              return result.data;
            },
            enrichProfiles: async (profiles: Record<string, unknown>[]) => {
              const result = await db.rpc("enrich_existing_football_profiles", {
                p_profiles: profiles,
              });
              if (result.error) throw new Error("database_profile_enrichment");
              return result.data;
            },
            upsert: async (target: string, rows: Record<string, unknown>[]) => {
              const key = (r: Record<string, unknown>) =>
                target === "api_football_data"
                  ? `${r.kind}|${r.ref}`
                  : target === "players"
                    ? r.source_id
                    : (r.source_id ?? r.id);
              const unique = [...new Map(rows.map((r) => [key(r), r])).values()];
              if (unique.length) writes.push({ target, rows: unique });
            },
          });
          await materialize(job, page, (path: string, kind: string, meta = {}, priority = 50) =>
            children.push({ path, kind, meta, priority }),
          );
          await rpc("football_queue_finish", {
            p_path: job.path,
            p_lease: job.lease_token,
            p_writes: writes,
            p_children: children,
            p_received: Array.isArray(page.response) ? page.response.length : 1,
            p_requests: jobRequests,
            p_remaining: summary.remaining,
          });
          summary.completed++;
        } catch (error) {
          const code = footballErrorCode(error);
          const budget = /quota|rate_wait|window_budget/.test(code);
          if (budget) {
            stopped = true;
            summary.stopReason ??= code;
          }
          const wait = /daily/.test(code)
            ? 86400
            : budget
              ? 60
              : Math.min(3600, 10 * 2 ** job.attempts);
          await rpc("football_queue_defer", {
            p_path: job.path,
            p_lease: job.lease_token,
            p_code: code,
            p_wait: wait,
            p_budget: budget,
          });
          if (budget) summary.deferred++;
          else summary.failed++;
        }
        if (adminToken) break;
      }
    };
    await Promise.all(Array.from({ length: lanes }, () => run()));
    await rpc("football_queue_window", { p_summary: summary });
    return reply(200, summary);
  } catch {
    return reply(503, { error: "football_window_unavailable" });
  }
});
