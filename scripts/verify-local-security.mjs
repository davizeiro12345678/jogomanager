// Bounded source-contract HTTP harness. It is NOT a production penetration test:
// authentication is synthetic and database/network provider writes are absent.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { SupportTicketInput } from "../src/lib/support-input.ts";
import { moderateMessage } from "../src/lib/moderation.ts";
import { AuthoritativeMatchSession } from "../src/game/online/authoritative-match-session.ts";
import { parseMatchCommandV1, parseMatchTicketV1 } from "../src/game/online/match-protocol.ts";

const startedAt = new Date().toISOString();
const started = performance.now();
const roomId = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const now = Date.now();
const token = "synthetic-harness-token-never-a-real-session";
const ticket = (seat) =>
  parseMatchTicketV1({
    version: 1,
    roomId,
    userId:
      seat === "home"
        ? "7b40bcbe-a4ca-430c-9b49-61aa9c5118e9"
        : "37bb485a-6ff6-4bd2-a1f4-6df6a0a1e4ef",
    seat,
    issuedAt: now,
    expiresAt: now + 60_000,
    nonce: `synthetic-nonce-${seat}`,
    signature: `synthetic-signature-${seat}`,
  });
let tacticalMutations = 0;
const session = new AuthoritativeMatchSession({
  roomId,
  homeTicket: ticket("home"),
  awayTicket: ticket("away"),
  simulationVersion: "isolated-test-only/1",
  idempotencyKey: "42711d45-34a3-4d6b-81bb-a67db8b7e4f0",
  signer: { sign: async () => "synthetic-test-receipt-signature" },
  engine: {
    advanceFixedStep() {},
    publicState: () => ({
      minute: 0,
      score: { home: 0, away: 0 },
      possession: { home: 50, away: 50 },
    }),
    presentationEvents: () => [],
    applyTactics: () => {
      tacticalMutations += 1;
      return true;
    },
    substitute: () => false,
    finalResult: () => ({ homeGoals: 0, awayGoals: 0, winner: "draw" }),
  },
});
const request = {
  requestId: "8534946c-d202-4b0b-a2ce-f39b35c181e3",
  category: "gameplay",
  subject: "Partida travou",
  message: "A partida travou durante o segundo tempo.",
};
const tactics = (sequence) => ({
  version: 1,
  roomId,
  sequence,
  kind: "set_tactics",
  payload: {
    formation: "4-3-3",
    mentality: "balanced",
    pressing: "high",
    width: "wide",
    tempo: "fast",
    lineHeight: "high",
  },
});
let stopped = null;
const server = createServer(async (req, res) => {
  const reply = (status) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end('{"isolatedHarness":true}');
  };
  if (req.headers.authorization !== `Bearer ${token}`) {
    req.resume();
    return reply(401);
  }
  if (Number(req.headers["content-length"] ?? 0) > 8192) {
    req.resume();
    return reply(413);
  }
  try {
    const chunks = [];
    let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 8192) return reply(413);
      chunks.push(chunk);
    }
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (req.url === "/support")
      return reply(SupportTicketInput.safeParse(input).success ? 202 : 400);
    if (req.url === "/moderation")
      return reply(
        typeof input.body === "string" && input.body.length <= 500
          ? moderateMessage(input.body)
            ? 422
            : 202
          : 400,
      );
    if (req.url === "/commands") {
      const command = parseMatchCommandV1(input);
      const result = await session.receive(ticket("home"), command, Date.now());
      return reply(result.accepted ? 202 : 429);
    }
    return reply(404);
  } catch (error) {
    if (error instanceof SyntaxError || error?.name === "ZodError") return reply(400);
    stopped = "unexpected_server_error";
    return reply(500);
  }
});
server.requestTimeout = 5000;
server.headersTimeout = 3000;
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("loopback_listener_missing");
const base = `http://127.0.0.1:${address.port}`;
const cases = [];
const add = (count, name, path, payload, statuses, authenticated = true) => {
  for (let index = 0; index < count; index++)
    cases.push({
      name,
      path,
      body: typeof payload === "function" ? payload(index) : JSON.stringify(payload),
      statuses,
      authenticated,
    });
};
add(80, "missing_auth", "/support", request, [401], false);
add(
  80,
  "forged_authority_or_json",
  "/support",
  (i) =>
    i % 2
      ? '{"bad":'
      : JSON.stringify({ ...request, email: "forged@example.com", delivered: true }),
  [400],
);
add(40, "oversized_support_message", "/support", { ...request, message: "x".repeat(5_000) }, [400]);
const disguised = [
  "visita ｈｔｔｐｓ：／／golpe.dev",
  "joao\u200b＠exemplo．com",
  "p.o.r.r.a",
  "https\u200b://golpe.store",
];
add(
  100,
  "moderation_evasion",
  "/moderation",
  (i) => JSON.stringify({ body: disguised[i % disguised.length] }),
  [422],
);
add(
  80,
  "forged_score_command",
  "/commands",
  (i) => JSON.stringify({ ...tactics(i + 1), score: { home: 99, away: 0 } }),
  [400],
);
add(20, "valid_support_shape_no_write", "/support", request, [202]);
add(100, "tactical_burst", "/commands", (i) => JSON.stringify(tactics(i + 1)), [202, 429]);
const results = [];
let next = 0;
let heartbeatAt = performance.now();
let maxEventLoopLagMs = 0;
const heartbeat = setInterval(() => {
  const instant = performance.now();
  const lag = Math.max(0, instant - heartbeatAt - 50);
  maxEventLoopLagMs = Math.max(maxEventLoopLagMs, lag);
  if (lag > 250) stopped ??= "event_loop_lag_exceeded_250ms";
  heartbeatAt = instant;
}, 50);
try {
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (!stopped && next < cases.length) {
        if (performance.now() - started > 30_000) {
          stopped = "time_budget_exceeded";
          break;
        }
        const scenario = cases[next++];
        const begin = performance.now();
        const response = await fetch(`${base}${scenario.path}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(scenario.authenticated ? { authorization: `Bearer ${token}` } : {}),
          },
          body: scenario.body,
          signal: AbortSignal.timeout(2000),
        });
        await response.arrayBuffer();
        const durationMs = performance.now() - begin;
        const passed = scenario.statuses.includes(response.status);
        results.push({ scenario: scenario.name, status: response.status, durationMs, passed });
        if (!passed || response.status >= 500) stopped ??= "unexpected_response";
        if (durationMs > 1000) stopped ??= "latency_exceeded_1000ms";
      }
    }),
  );
} catch {
  stopped ??= "request_failed_or_timed_out";
} finally {
  clearInterval(heartbeat);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
const percentile = (p) =>
  durations[Math.min(durations.length - 1, Math.ceil(durations.length * p) - 1)] ?? null;
const sources = [
  "src/lib/support-input.ts",
  "src/lib/moderation.ts",
  "src/game/online/authoritative-match-session.ts",
  "src/lib/multiplayer-room-create.server.ts",
  "src/lib/offline/store.ts",
];
const sourceHash = createHash("sha256");
for (const path of sources)
  sourceHash.update(path).update(await readFile(new URL(`../${path}`, import.meta.url)));
const evidence = {
  kind: "isolated_source_contract_http_harness",
  startedAt,
  runtime: process.version,
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDigest: sourceHash.digest("hex"),
  sources,
  scope:
    "Loopback-only synthetic authentication; actual input/moderation/session modules; no real users, database mutations, webhook delivery or production endpoints.",
  limits: {
    concurrency: 4,
    requests: 500,
    timeMs: 30_000,
    harnessTransportCapBytes: 8192,
    stopEventLoopLagMs: 250,
    stopLatencyMs: 1000,
  },
  planned: cases.length,
  completed: results.length,
  passed: results.filter((result) => result.passed).length,
  stopped,
  durationMs: performance.now() - started,
  latencyMs: {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    max: durations.at(-1),
    maxEventLoopLag: maxEventLoopLagMs,
  },
  scenarios: [...new Set(results.map((result) => result.scenario))].map((scenario) => {
    const selected = results.filter((result) => result.scenario === scenario);
    return {
      scenario,
      count: selected.length,
      passed: selected.filter((result) => result.passed).length,
      statuses: selected.reduce(
        (acc, result) => ({ ...acc, [result.status]: (acc[result.status] ?? 0) + 1 }),
        {},
      ),
    };
  }),
  tacticalMutations,
  invalidAttemptHistorySize: session.invalidAttempts.length,
};
evidence.success =
  !stopped &&
  evidence.completed === 500 &&
  evidence.passed === 500 &&
  tacticalMutations === 12 &&
  session.invalidAttempts.length <= 128;
const output = new URL(
  "../verification/quality-update-20261108/local-security-harness.json",
  import.meta.url,
);
await mkdir(new URL(".", output), { recursive: true });
await writeFile(output, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
if (!evidence.success) process.exitCode = 1;
