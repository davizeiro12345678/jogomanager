// Scheduled sports-only import. The body authenticates both cron and admin;
// neither the queue nor the provider key is available to browser clients.
import { createClient } from "npm:@supabase/supabase-js@2.101.0";
import { createFootballMaterializer } from "../_shared/football-materialize.mjs";
import { loadFootballJobPage, footballErrorCode } from "../_shared/football-window.mjs";

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
    const deadline = Date.now() + 45000,
      summary = {
        completed: 0,
        failed: 0,
        deferred: 0,
        requests: 0,
        remaining: null as number | null,
      };
    let stopped = false,
      nextRequest = Date.now();
    const lanes = adminToken ? 1 : 3;
    const run = async () => {
      while (!stopped && Date.now() < deadline - 5000 && summary.requests < 120) {
        const job = await rpc("football_queue_claim");
        if (!job) break;
        let jobRequests = 0;
        try {
          const page = await loadFootballJobPage(job, {
            rpc,
            beforeRequest: async () => {
              if (!job.path.startsWith("/") || job.path.startsWith("//"))
                throw new Error("invalid_provider_path");
              const slot = Math.max(Date.now(), nextRequest);
              nextRequest = slot + 350;
              if (slot > deadline - 5000) throw new Error("window_budget");
              await new Promise((r) => setTimeout(r, Math.max(0, slot - Date.now())));
            },
            requestPage: async () => {
              summary.requests++;
              jobRequests++;
              const response = await fetch("https://v3.football.api-sports.io" + job.path, {
                headers: { "x-apisports-key": settings.apiKey },
                signal: AbortSignal.timeout(
                  Math.max(1, Math.min(18000, deadline - Date.now() - 1500)),
                ),
              });
              const remaining = response.headers.get("x-ratelimit-requests-remaining");
              if (remaining !== null && Number.isFinite(Number(remaining)))
                summary.remaining = Math.min(summary.remaining ?? Infinity, Number(remaining));
              if (response.status === 429) {
                await response.body?.cancel();
                throw new Error("provider_rate_wait");
              }
              if (!response.ok) {
                await response.body?.cancel();
                throw new Error("provider_http_" + response.status);
              }
              return response.json();
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
          if (budget) {
            summary.deferred++;
            stopped = true;
          } else summary.failed++;
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
