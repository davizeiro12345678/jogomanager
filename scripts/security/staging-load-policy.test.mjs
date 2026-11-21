import assert from "node:assert/strict";
import test from "node:test";
import { validateStagingTarget, SAFE_PUBLIC_PATHS, LOAD_PEAK_RPS } from "./staging-load-policy.js";

test("accepts only independently approved, isolated staging with exact HTTPS origin", () => {
  assert.equal(
    validateStagingTarget({
      target: "https://staging.jogomanager.com/",
      isolation: "ISOLATED-STAGING-VERIFIED",
    }),
    "https://staging.jogomanager.com",
  );
});

test("refuses production, lookalikes and URL redirection tricks", () => {
  for (const target of [
    "https://jogomanager.com",
    "https://www.jogomanager.com",
    "http://staging.jogomanager.com",
    "https://staging.jogomanager.com.attacker.test",
    "https://staging.jogomanager.com@evil.example",
    "https://staging.jogomanager.com:8443",
    "https://staging.jogomanager.com/redirect",
    "https://staging.jogomanager.com/?destination=https://jogomanager.com",
  ]) {
    assert.throws(
      () =>
        validateStagingTarget({
          target,
          isolation: "ISOLATED-STAGING-VERIFIED",
        }),
      /staging|origin|target/i,
      target,
    );
  }
});

test("refuses launch if the independent environment attestation is missing", () => {
  assert.throws(
    () =>
      validateStagingTarget({
        target: "https://staging.jogomanager.com/",
        isolation: "",
      }),
    /isolation/i,
  );
});

test("safe endpoints are read-only public paths, and peak budget is exactly 4k total RPS", () => {
  assert.equal(LOAD_PEAK_RPS, 4000);
  assert.ok(SAFE_PUBLIC_PATHS.length >= 5);
  for (const path of SAFE_PUBLIC_PATHS) {
    assert.match(path, /^\/[a-z0-9/.-]*$/);
    assert.doesNotMatch(path, /auth|checkout|payment|api|serverfn|login|save|admin/i);
  }
});
