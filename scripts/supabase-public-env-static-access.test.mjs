import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../src/integrations/supabase/client.ts", import.meta.url),
  "utf8",
);

test("browser Supabase public variables are statically replaceable by Vite", () => {
  for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    assert.ok(
      source.includes(`import.meta.env.${key}`),
      `${key} must use full dot notation for production Vite replacement`,
    );
    assert.ok(
      !source.includes(`import.meta.env["${key}"]`) &&
        !source.includes(`import.meta.env['${key}']`),
      `${key} cannot use computed bracket access`,
    );
  }
});

test("browser Supabase bootstrap never receives server secret-role key", () => {
  assert.ok(!source.includes("import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(!source.includes("import.meta.env.VITE_SUPABASE_SECRET_KEY"));
});

test("Supabase public Vite properties are declared for strict TypeScript", () => {
  const declaration = readFileSync(
    new URL("../src/types/supabase-public-env.d.ts", import.meta.url),
    "utf8",
  );
  for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]) {
    assert.match(declaration, new RegExp(`readonly\\s+${key}\\s*:\\s*string`));
  }
  assert.doesNotMatch(declaration, /(?:SERVICE_ROLE|sb_secret_|STRIPE_SECRET)/i);
});
