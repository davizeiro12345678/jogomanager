import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";
import {
  footballProviderRetryAfterMs,
  footballProviderRateError,
  footballWindowBudget,
  loadFootballJobPage,
  parseRetryAfterMs,
  validateFootballPage,
} from "../supabase/functions/_shared/football-window.mjs";

// Execute the deployed handlers with isolated Deno bindings and fully mocked
// transports. No environment credentials or live network are used by these tests.
async function loadHandler(relativePath, options = {}) {
  const url = new URL("../supabase/functions/" + relativePath, import.meta.url);
  const source = stripTypeScriptTypes(await readFile(url, "utf8"), { mode: "strip" });
  const imports = {};
  const pattern = /^import\s+(\{[\s\S]*?\})\s+from\s+["']([^"']+)["'];?/gm;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[2];
    imports[specifier] = specifier.startsWith("npm:")
      ? { createClient: options.createClient ?? (() => assert.fail("Unexpected database client")) }
      : await import(new URL(specifier, url).href);
  }
  const executable = source.replace(
    pattern,
    (_match, names, specifier) =>
      "const " + names + " = __imports[" + JSON.stringify(specifier) + "];",
  );
  let handler;
  vm.runInNewContext(
    executable,
    {
      __imports: imports,
      Deno: {
        env: {
          get: (name) =>
            ({
              SUPABASE_URL: "https://project.example.test",
              SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role",
              ...options.env,
            })[name],
        },
        serve: (value) => {
          handler = value;
        },
      },
      fetch: options.fetch ?? (() => assert.fail("Unexpected network request")),
      Request,
      Response,
      URL,
      URLSearchParams,
      TextEncoder,
      AbortSignal,
      crypto: webcrypto,
      setTimeout,
      console: { error() {} },
    },
    { filename: url.pathname },
  );
  assert.equal(typeof handler, "function");
  return handler;
}

const workerToken = "a".repeat(64);
const schedulerToken = "test-only-scheduler";
const request = (path, body = {}, headers = {}) =>
  new Request("https://project.example.test/functions/v1/" + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
const json = (value) => Response.json(value);
const page = { response: [], errors: [], paging: { current: 1, total: 1 } };
const job = { kind: "teams", path: "/teams?page=1", lease_token: "test-lease" };

test("API-Football rejects method and malformed credentials before creating a privileged client", async () => {
  const handler = await loadHandler("api-football-import/index.ts");
  assert.equal(
    (await handler(new Request("https://project.example.test", { method: "GET" }))).status,
    405,
  );
  for (const token of ["", "short", "g".repeat(64)]) {
    assert.equal(
      (
        await handler(
          request(
            "api-football-import",
            { action: "run" },
            {
              "x-football-worker": token,
            },
          ),
        )
      ).status,
      401,
    );
  }
});

test("API-Football hashes a valid-shaped token and rejects unknown credentials before queue work", async () => {
  const calls = [];
  const handler = await loadHandler("api-football-import/index.ts", {
    createClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: null, error: null };
      },
    }),
  });
  const response = await handler(
    request(
      "api-football-import",
      { action: "run" },
      {
        "x-football-worker": workerToken,
      },
    ),
  );
  assert.equal(response.status, 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "football_queue_settings");
  assert.equal(calls[0].args.p_hash, createHash("sha256").update(workerToken).digest("hex"));
  assert.equal(calls[0].args.p_admin, false);
});

test("API-Football distributes scheduled work across the requested bounded lanes", async () => {
  let claims = 0;
  let summary;
  const handler = await loadHandler("api-football-import/index.ts", {
    createClient: () => ({
      rpc: async (name, args) => {
        if (name === "football_queue_settings")
          return {
            data: { apiKey: "test-provider-key", enabled: true, nextRunAt: "2000-01-01T00:00:00Z" },
            error: null,
          };
        if (name === "football_queue_claim") claims++;
        if (name === "football_queue_window") summary = args.p_summary;
        return { data: null, error: null };
      },
    }),
  });
  const response = await handler(
    request(
      "api-football-import",
      { action: "run", workerLanes: 4 },
      { "x-football-worker": workerToken },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(claims, 4);
  assert.equal(summary.lanes, 4);
  assert.equal(summary.completed, 0);
});

test("API-Football rejects invalid scheduled lane counts before claiming jobs", async () => {
  let claims = 0;
  const handler = await loadHandler("api-football-import/index.ts", {
    createClient: () => ({
      rpc: async (name) => {
        if (name === "football_queue_claim") claims++;
        return {
          data: { apiKey: "test-provider-key", enabled: true, nextRunAt: "2000-01-01T00:00:00Z" },
          error: null,
        };
      },
    }),
  });
  for (const workerLanes of [0, 17, 1.5, "4", null]) {
    const response = await handler(
      request(
        "api-football-import",
        { action: "run", workerLanes },
        { "x-football-worker": workerToken },
      ),
    );
    assert.equal(response.status, 400);
  }
  assert.equal(claims, 0);
});

test("API-Football worker credentials do not authorize admin actions", async () => {
  const calls = [];
  const handler = await loadHandler("api-football-import/index.ts", {
    createClient: () => ({
      rpc: async (name) => {
        calls.push(name);
        return { data: { apiKey: "test-provider-key", enabled: true }, error: null };
      },
    }),
  });
  const response = await handler(
    request(
      "api-football-import",
      { action: "activate", enabled: true },
      {
        "x-football-worker": workerToken,
      },
    ),
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_action" });
  assert.deepEqual(calls, ["football_queue_settings"]);
});

test("API-Football validates admin credentials before returning queue status", async () => {
  const calls = [];
  const handler = await loadHandler("api-football-import/index.ts", {
    createClient: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: name === "football_queue_settings" ? {} : { queued: 0 }, error: null };
      },
    }),
  });
  const response = await handler(
    request(
      "api-football-import",
      { action: "status" },
      {
        "x-football-admin": workerToken,
      },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(calls[0].args.p_admin, true);
  assert.deepEqual(
    calls.map((call) => call.name),
    ["football_queue_settings", "football_queue_status"],
  );
});

test("SportsDB rejects missing or invalid scheduler credentials before acquiring work", async () => {
  const calls = [];
  const handler = await loadHandler("sportsdb-bridge/index.ts", {
    fetch: async (url) => {
      calls.push(String(url));
      return json(false);
    },
  });
  assert.equal((await handler(request("sportsdb-bridge"))).status, 401);
  assert.equal(calls.length, 0);
  const denied = await handler(
    request(
      "sportsdb-bridge",
      {},
      {
        authorization: "Bearer " + schedulerToken,
      },
    ),
  );
  assert.equal(denied.status, 401);
  assert.deepEqual(calls, ["https://project.example.test/rest/v1/rpc/sportsdb_bridge_authorize"]);
});

test("SportsDB /authorize answers authorization without acquiring a sync lease", async () => {
  const calls = [];
  const handler = await loadHandler("sportsdb-bridge/index.ts", {
    fetch: async (url, options) => {
      calls.push(String(url));
      assert.equal(JSON.parse(options.body).p_token, schedulerToken);
      return json(true);
    },
  });
  const response = await handler(
    request(
      "sportsdb-bridge/authorize",
      {},
      {
        authorization: "Bearer " + schedulerToken,
      },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(await response.json(), true);
  assert.deepEqual(calls, ["https://project.example.test/rest/v1/rpc/sportsdb_bridge_authorize"]);
});

test("SportsDB keeps production source credentials and does not persist full archive payloads", async () => {
  const calls = [];
  const upstream = [];
  let workCount = 0;
  const handler = await loadHandler("sportsdb-bridge/index.ts", {
    env: {
      SPORTSDB_CF_ACCESS_CLIENT_ID: "test-only-access-id",
      SPORTSDB_CF_ACCESS_CLIENT_SECRET: "test-only-access-secret",
    },
    fetch: async (input, options) => {
      const url = new URL(input);
      if (url.origin === "https://project.example.test") {
        const name = url.pathname.split("/").at(-1);
        const args = JSON.parse(options.body);
        calls.push({ name, args });
        if (name === "sportsdb_bridge_authorize") return json(true);
        if (name === "sportsdb_bridge_acquire") return json("test-owner");
        if (name === "sportsdb_bridge_work")
          return json(
            workCount++ === 0
              ? {
                  archives: [
                    {
                      archive_key: "sportsdb/v2/lookup/league/1/_/_.json",
                      source_updated_at: "2026-10-20",
                    },
                  ],
                }
              : { paused: true },
          );
        return json(true);
      }
      assert.equal(url.origin, "https://jogomanager-web.davizeiro10-jogos.workers.dev");
      assert.equal(options.headers.authorization, "Bearer " + schedulerToken);
      assert.equal(options.headers["CF-Access-Client-Id"], "test-only-access-id");
      assert.equal(options.headers["CF-Access-Client-Secret"], "test-only-access-secret");
      upstream.push(url);
      return json(
        url.searchParams.has("status")
          ? { source: "TheSportsDB", counts: [], archive: { objects: 1 }, phases: [] }
          : { lookup: [] },
      );
    },
  });
  const response = await handler(
    request(
      "sportsdb-bridge",
      {},
      {
        authorization: "Bearer " + schedulerToken,
      },
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(upstream.length, 2);
  assert.equal(calls.find((call) => call.name === "sportsdb_bridge_archive").args.p_payload, null);
});

test("SportsDB rejects a partial Cloudflare Access credential configuration before contacting the source", async () => {
  const calls = [];
  const handler = await loadHandler("sportsdb-bridge/index.ts", {
    env: { SPORTSDB_CF_ACCESS_CLIENT_ID: "test-only-access-id" },
    fetch: async (input) => {
      const url = new URL(input);
      assert.equal(url.origin, "https://project.example.test");
      const name = url.pathname.split("/").at(-1);
      calls.push(name);
      return json(name === "sportsdb_bridge_acquire" ? "test-owner" : true);
    },
  });
  const response = await handler(
    request(
      "sportsdb-bridge",
      {},
      {
        authorization: "Bearer " + schedulerToken,
      },
    ),
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /configured together/);
  assert.deepEqual(calls, [
    "sportsdb_bridge_authorize",
    "sportsdb_bridge_acquire",
    "sportsdb_bridge_release",
  ]);
});

test("API-Football bounds scheduled work and keeps the manual pilot single-lane", () => {
  assert.deepEqual(footballWindowBudget("3", false), {
    lanes: 3,
    spacingMs: 267,
    maxRequests: 150,
  });
  const custom = footballWindowBudget("999", false);
  assert.equal(custom.lanes, 48);
  assert.ok(custom.spacingMs >= 110);
  assert.equal(custom.maxRequests, 880);
  assert.ok(custom.maxRequests * 1440 >= 445000);
  assert.equal(footballWindowBudget("16", true).lanes, 1);
  assert.equal(footballWindowBudget("invalid", false).lanes, 1);
});

test("API-Football treats HTTP 200 rateLimit payloads as backpressure, not data", () => {
  assert.throws(
    () =>
      validateFootballPage(
        {
          errors: { rateLimit: "You have reached your per-minute request limit." },
          response: [],
        },
        { kind: "player_team", path: "/players/teams?player=7" },
      ),
    /provider_rate_wait/,
  );
});

test("API-Football distinguishes a depleted day from a transient 429", () => {
  const response = (status, remaining) =>
    new Response(null, { status, headers: { "x-ratelimit-requests-remaining": remaining } });
  assert.equal(footballProviderRateError(response(429, "0")), "provider_daily_quota");
  assert.equal(footballProviderRateError(response(429, "100")), "provider_rate_wait");
  assert.equal(footballProviderRateError(response(429, "")), "provider_rate_wait");
  assert.equal(footballProviderRateError(response(200, "0")), null);
});

test("API-Football parses bounded Retry-After delta-seconds", () => {
  assert.equal(parseRetryAfterMs(" 5 ", 0), 5_000);
  assert.equal(parseRetryAfterMs("0", 0), 0);
  assert.equal(parseRetryAfterMs("1.5", 0), null);
  assert.equal(parseRetryAfterMs("-1", 0), null);
  assert.equal(parseRetryAfterMs("999999999999999999999", 0), 8_000);
});

test("API-Football parses Retry-After HTTP-date using the supplied clock", () => {
  const now = Date.parse("Wed, 21 Oct 2015 07:28:00 GMT");
  assert.equal(parseRetryAfterMs("Wed, 21 Oct 2015 07:28:05 GMT", now), 5_000);
  assert.equal(parseRetryAfterMs("Wed Oct 21 07:28:05 2015", now), 5_000);
  assert.equal(parseRetryAfterMs("Wed, 21 Oct 2015 07:27:59 GMT", now), 0);
  assert.equal(parseRetryAfterMs("Wed, 21 Oct 2015 07:28:30 GMT", now), 8_000);
  assert.equal(parseRetryAfterMs("not-a-date", now), null);
  assert.equal(parseRetryAfterMs("Wed, 21 Oct 2015 07:28:05 GMT", Number.NaN), null);
  assert.equal(
    footballProviderRetryAfterMs(
      new Response(null, {
        status: 429,
        headers: { "retry-after": "Wed, 21 Oct 2015 07:28:05 GMT" },
      }),
      now,
    ),
    5_000,
  );
});

test("API-Football cached pages are validated and reused without reserving or requesting again", async () => {
  const forbidden = () => assert.fail("Cached responses must not consume another provider request");
  assert.equal(
    await loadFootballJobPage(
      { ...job, cached_body: page },
      {
        rpc: forbidden,
        beforeRequest: forbidden,
        requestPage: forbidden,
      },
    ),
    page,
  );
  await assert.rejects(
    () =>
      loadFootballJobPage(
        {
          ...job,
          cached_body: { ...page, paging: { current: 2, total: 2 } },
        },
        { rpc: forbidden, beforeRequest: forbidden, requestPage: forbidden },
      ),
    /page_mismatch/,
  );
});

test("API-Football reserves per lease and caches a validated response before returning to catalog writes", async () => {
  const order = [];
  const result = await loadFootballJobPage(job, {
    beforeRequest: async () => {
      order.push("budget");
    },
    requestPage: async () => {
      order.push("provider");
      return page;
    },
    rpc: async (name, args) => {
      order.push(name);
      assert.equal(args.p_path, job.path);
      assert.equal(args.p_lease, job.lease_token);
      if (name === "football_queue_cache_page") assert.equal(args.p_body, page);
    },
  });
  assert.equal(result, page);
  assert.deepEqual(order, [
    "budget",
    "football_queue_reserve_job",
    "provider",
    "football_queue_cache_page",
  ]);
});

test("API-Football quota rejection prevents provider traffic", async () => {
  await assert.rejects(
    () =>
      loadFootballJobPage(job, {
        beforeRequest: async () => {},
        rpc: async () => {
          throw new Error("football_daily_quota_wait");
        },
        requestPage: () => assert.fail("Quota rejection must stop the provider request"),
      }),
    /daily_quota_wait/,
  );
});

test("API-Football cache persistence failure prevents returning a page for catalog writes", async () => {
  let returned = false;
  await assert.rejects(async () => {
    await loadFootballJobPage(job, {
      beforeRequest: async () => {},
      requestPage: async () => page,
      rpc: async (name) => {
        if (name === "football_queue_cache_page") throw new Error("database_cache_failure");
      },
    });
    returned = true;
  }, /database_cache_failure/);
  assert.equal(returned, false);
});

test("API-Football rejects corrupt pages and filters self-opponents before materialization", () => {
  const job = { kind: "fixtures", path: "/fixtures?league=71&season=2026" };
  const fixture = {
    fixture: { id: 100 },
    league: { id: 71, season: 2026 },
    teams: { home: { id: 1 }, away: { id: 2 } },
  };
  assert.equal(validateFootballPage({ response: [fixture] }, job).response.length, 1);
  assert.deepEqual(validateFootballPage({ response: [fixture, fixture] }, job).response, [fixture]);
  assert.throws(
    () =>
      validateFootballPage({ response: [{ ...fixture, league: { id: 72, season: 2026 } }] }, job),
    /invalid_fixture/,
  );
  assert.deepEqual(
    validateFootballPage(
      {
        response: [
          fixture,
          { ...fixture, fixture: { id: 102 }, teams: { home: { id: 1 }, away: { id: 1 } } },
          { ...fixture, fixture: { id: 103 }, teams: { home: { id: 1 }, away: { id: null } } },
        ],
      },
      job,
    ).response,
    [fixture],
  );
  assert.throws(
    () =>
      validateFootballPage(
        { response: [fixture] },
        { kind: "fixture_detail", path: "/fixtures?ids=101" },
      ),
    /invalid_fixture/,
  );
});
