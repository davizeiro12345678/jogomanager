import { request } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [
  target = "http://127.0.0.1:8787",
  output = "verification/match-authority-staging/local-closed-gate.json",
] = process.argv.slice(2);
const origin = new URL(target);
if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
  throw new Error("Only a loopback Wrangler emulator is accepted for disabled-stage smoke tests");
if (origin.pathname !== "/" || origin.search || origin.hash)
  throw new Error("Smoke base must be the local Worker origin, not a route");

const room = "45fd1d08-4f81-44bc-9072-1e35ce9d1d94";
const handshake = {
  Connection: "Upgrade",
  Upgrade: "websocket",
  Origin: "https://staging.jogomanager.com",
  "Sec-WebSocket-Version": "13",
  "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
};
const checks = [
  { path: "/", method: "GET" },
  { path: "/health", method: "GET" },
  { path: `/rooms/${room}/socket`, method: "GET" },
  { path: `/rooms/${room}/socket`, method: "GET", headers: handshake },
  { path: `/rooms/${room}/socket?token=never-allowed`, method: "GET", headers: handshake },
  { path: `/rooms/${room}/socket`, method: "OPTIONS", headers: { Origin: handshake.Origin } },
];
const probe = ({ path, method, headers }) =>
  new Promise((done, reject) => {
    const req = request(new URL(path, origin), { method, headers, timeout: 4_000 }, (res) => {
      let bytes = 0;
      res.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 8_192) req.destroy(new Error("Unexpected large response"));
      });
      res.on("end", () =>
        done({
          path,
          method,
          upgradeAttempt: Boolean(headers?.Upgrade),
          status: res.statusCode,
          bytes,
          setCookie: Boolean(res.headers["set-cookie"]),
        }),
      );
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Local Worker timed out")));
    req.on("upgrade", () => req.destroy(new Error("Disabled staging upgraded a WebSocket")));
    req.on("error", reject);
    req.end();
  });

const results = [];
for (const check of checks) {
  const result = await probe(check);
  results.push(result);
  if (result.status !== 404 || result.setCookie) {
    throw new Error(
      `Disabled stage violated its fail-closed contract on ${check.method} ${check.path}: HTTP ${result.status}`,
    );
  }
}
const summary = {
  sha: process.env.GITHUB_SHA ?? "local",
  scope: "isolated Wrangler loopback; no production routes, credentials, or devices",
  validated: results.length,
  failClosed: true,
  checks: results,
};
const file = resolve(output);
await mkdir(resolve(file, ".."), { recursive: true });
await writeFile(file, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary));
