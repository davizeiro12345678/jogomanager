import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { signedReadiness } from "./readiness.mjs";
import { signRequest, verifyRequest } from "./signature.mjs";

const key = "test-only-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const body = '{"probe":"readiness"}';

function call(ping, isBusy, message = body, signature = null) {
  const timestamp = String(Date.now());
  return signedReadiness(
    message,
    timestamp,
    signature ?? signRequest(timestamp, message, key),
    key,
    ping,
    isBusy,
  );
}

test("reports database reachability and simulation slot availability", async () => {
  assert.deepEqual(
    await call(
      async () => ({ ok: 1 }),
      () => true,
    ),
    { status: 200, body: { ok: true, busy: true } },
  );
  assert.deepEqual(
    await call(
      async () => ({ ok: 1 }),
      () => false,
    ),
    { status: 200, body: { ok: true, busy: false } },
  );
});

test("rejects unsigned or wrong-purpose requests before accessing the database", async () => {
  let count = 0;
  const ping = async () => {
    count++;
    return { ok: 1 };
  };
  assert.equal((await call(ping, () => false, body, "0".repeat(64))).status, 401);
  assert.equal((await call(ping, () => false, '{"probe":"other"}')).status, 400);
  assert.equal(count, 0);
});

test("fails closed without disclosing database errors", async () => {
  const result = await call(
    async () => {
      throw new Error("private database details");
    },
    () => false,
  );
  assert.deepEqual(result, { status: 503, body: { ok: false, busy: false } });
  assert.deepEqual(
    await call(
      async () => ({ ok: 0 }),
      () => false,
    ),
    { status: 503, body: { ok: false, busy: false } },
  );
});

test("the operations command signs a loopback readiness request", async () => {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const message = Buffer.concat(chunks).toString("utf8");
    const authorized =
      req.method === "POST" &&
      req.url === "/v1/readiness" &&
      message === body &&
      verifyRequest(req.headers["x-pfm-timestamp"], message, req.headers["x-pfm-signature"], key);
    res.writeHead(authorized ? 200 : 401, { "content-type": "application/json" });
    res.end(JSON.stringify(authorized ? { ok: true, busy: false } : { error: "unauthorized" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [fileURLToPath(new URL("./ops/check-readiness.mjs", import.meta.url))],
      {
        env: {
          ...process.env,
          MATCH_AUX_URL: `http://127.0.0.1:${server.address().port}`,
          MATCH_AUX_SIGNING_KEY: key,
        },
        timeout: 6000,
      },
    );
    assert.deepEqual(JSON.parse(stdout), { ok: true, busy: false });
    assert.equal(stdout.includes(key), false);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
