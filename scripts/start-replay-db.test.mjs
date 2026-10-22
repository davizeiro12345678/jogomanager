import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

function run(mode) {
  const dir = mkdtempSync(path.join(tmpdir(), "replay-mirror-"));
  writeFileSync(
    path.join(dir, "supabase"),
    `#!/usr/bin/env bash
printf '%s\\n' "$SUPABASE_INTERNAL_IMAGE_REGISTRY" >> "$REPLAY_CALLS"
case "$REPLAY_MODE" in
  success) exit 0 ;;
  fallback) if [[ "$SUPABASE_INTERNAL_IMAGE_REGISTRY" == public.ecr.aws ]]; then exit 0; fi ;;
  failure) echo 'database health check failed'; exit 17 ;;
esac
echo 'failed to pull docker image: toomanyrequests'
exit 9
`,
    { mode: 0o755 },
  );
  const envFile = path.join(dir, "env");
  const callsFile = path.join(dir, "calls");
  writeFileSync(envFile, "");
  const result = spawnSync("bash", ["scripts/start-replay-db.sh"], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      GITHUB_ENV: envFile,
      REPLAY_CALLS: callsFile,
      REPLAY_MODE: mode,
    },
  });
  return {
    status: result.status,
    calls: readFileSync(callsFile, "utf8").trim().split("\n"),
    persisted: readFileSync(envFile, "utf8"),
  };
}
test("keeps the successful official registry for the subsequent reset", () => {
  const result = run("success");
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, ["ghcr.io"]);
  assert.equal(result.persisted, "SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr.io\n");
});
test("uses the next official mirror only after a registry rate limit", () => {
  const result = run("fallback");
  assert.equal(result.status, 0);
  assert.deepEqual(result.calls, ["ghcr.io", "public.ecr.aws"]);
  assert.equal(result.persisted, "SUPABASE_INTERNAL_IMAGE_REGISTRY=public.ecr.aws\n");
});
test("does not hide database or health failures with retries", () => {
  const result = run("failure");
  assert.equal(result.status, 17);
  assert.deepEqual(result.calls, ["ghcr.io"]);
  assert.equal(result.persisted, "");
});
test("fails when all official registries are rate limited", () => {
  const result = run("exhausted");
  assert.equal(result.status, 9);
  assert.deepEqual(result.calls, ["ghcr.io", "public.ecr.aws", "docker.io"]);
  assert.equal(result.persisted, "");
});
