import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const path of ["../src/lib/stripe.ts", "../src/components/PaymentTestModeBanner.tsx"]) {
  test(path + " exposes the public Stripe key through Vite static dot notation", () => {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.ok(
      source.includes("import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN"),
      "The Vite compiler must be able to replace VITE_PAYMENTS_CLIENT_TOKEN",
    );
    assert.doesNotMatch(source, /import\.meta\.env\[['"]VITE_PAYMENTS_CLIENT_TOKEN['"]\]/);
  });
}

test("the Stripe publishable key is explicitly typed for strict TypeScript", () => {
  const definition = readFileSync(
    new URL("../src/types/stripe-public-env.d.ts", import.meta.url),
    "utf8",
  );
  assert.match(definition, /readonly\s+VITE_PAYMENTS_CLIENT_TOKEN\s*:/);
  assert.doesNotMatch(definition, /(?:STRIPE_LIVE_API_KEY|STRIPE_SECRET_KEY|sk_live_|rk_live_)/);
});

test("GitHub production build loads Stripe public token before compiling", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/cloudflare-production.yml", import.meta.url),
    "utf8",
  );
  const keyLoading = workflow.indexOf(
    "Load and validate existing public Stripe key before the Vite build",
  );
  const build = workflow.indexOf("Build and publish Worker with Wrangler");
  assert.ok(
    keyLoading > 0 && keyLoading < build,
    "Worker public key must be provided before the build",
  );
  assert.match(workflow, /VITE_PAYMENTS_CLIENT_TOKEN=\$\{public_key\}/);
  assert.match(workflow, /VITE_AUTH_MODE: supabase-direct/);
});
