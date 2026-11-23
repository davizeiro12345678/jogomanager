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
