import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

for (const path of ["../src/lib/stripe.ts", "../src/components/PaymentTestModeBanner.tsx"]) {
  test(path + " uses a statically replaceable Stripe publishable key", () => {
    const source = read(path);
    assert.match(source, /import\.meta\.env\.VITE_PAYMENTS_CLIENT_TOKEN\b/);
    assert.doesNotMatch(source, /import\.meta\.env\[['"]VITE_PAYMENTS_CLIENT_TOKEN['"]\]/);
  });
}

test("the Cloudflare production workflow supplies a validated live publishable key to Vite", () => {
  const source = read("../.github/workflows/cloudflare-production.yml");
  const load = source.indexOf("Load the existing live Stripe publishable key");
  const build = source.indexOf("Build and publish Worker with Wrangler");
  assert.ok(load >= 0 && load < build);
  const keyStep = source.slice(load, build);
  assert.match(keyStep, /\^pk_live_\[A-Za-z0-9\]\+\$/);
  assert.match(keyStep, /VITE_PAYMENTS_CLIENT_TOKEN=%s/);
  assert.match(keyStep, /"\$GITHUB_ENV"/);
});
