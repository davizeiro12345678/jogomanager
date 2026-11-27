import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Stripe publishable key is statically substituted into client bundles", () => {
  for (const path of ["src/lib/stripe.ts", "src/components/PaymentTestModeBanner.tsx"]) {
    const content = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.ok(
      content.includes("import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN"),
      `${path} must use Vite's statically replaceable property access`,
    );
    assert.ok(!content.includes('import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"]'));
  }
});

test("strict browser env types declare only the public Stripe key", () => {
  const declaration = readFileSync(
    new URL("../src/types/supabase-public-env.d.ts", import.meta.url),
    "utf8",
  );
  assert.match(declaration, /readonly VITE_PAYMENTS_CLIENT_TOKEN: string \| undefined;/);
  assert.doesNotMatch(declaration, /STRIPE_(?:SECRET|LIVE_API_KEY)/);
});
