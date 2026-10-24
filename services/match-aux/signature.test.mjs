import assert from "node:assert/strict";
import { test } from "node:test";
import { signRequest, verifyRequest } from "./signature.mjs";

const key = "test-only-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const timestamp = "1792860000000";
const body = JSON.stringify({ roomId: "test", seed: "not-a-production-seed" });

test("valid signed message", () => {
  const signature = signRequest(timestamp, body, key);
  assert.equal(verifyRequest(timestamp, body, signature, key, Number(timestamp)), true);
});
test("detects tampered seed, body, and signature", () => {
  const signature = signRequest(timestamp, body, key);
  assert.equal(verifyRequest(timestamp, body + "!", signature, key, Number(timestamp)), false);
  assert.equal(verifyRequest(timestamp, body, "0".repeat(64), key, Number(timestamp)), false);
});
test("rejects expired, future, invalid timestamps", () => {
  const sig = signRequest(timestamp, body, key);
  assert.equal(verifyRequest(timestamp, body, sig, key, Number(timestamp) + 31_000), false);
  assert.equal(verifyRequest(timestamp, body, sig, key, Number(timestamp) - 31_000), false);
  assert.equal(verifyRequest("NaN", body, sig, key), false);
});
test("rejects weak secrets", () => {
  assert.throws(() => signRequest(timestamp, body, "short"));
});
