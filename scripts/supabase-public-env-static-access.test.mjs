import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_AUTH_MODE",
    "VITE_AUTH_PROVIDER_ALLOWLIST",
  ]) {
    assert.match(declaration, new RegExp(`readonly\\s+${key}\\s*:\\s*string`));
  }
  assert.doesNotMatch(declaration, /(?:SERVICE_ROLE|sb_secret_|STRIPE_SECRET)/i);
});

test("auth method discovery and native OAuth use build-time public variables", () => {
  const discovery = readFileSync(
    new URL("../src/integrations/supabase/social-auth.ts", import.meta.url),
    "utf8",
  );
  for (const key of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_AUTH_PROVIDER_ALLOWLIST",
  ]) {
    assert.ok(discovery.includes(`import.meta.env.${key}`), key);
  }
  const authPage = readFileSync(new URL("../src/pages/auth.tsx", import.meta.url), "utf8");
  assert.ok(
    authPage.includes("supabase.auth.signInWithOAuth"),
    "published OAuth must use the configured Supabase provider",
  );
  assert.ok(
    !authPage.includes("lovable.auth.signInWithOAuth"),
    "published OAuth must not call the missing /~oauth/initiate broker",
  );
});

test("all browser modules avoid computed access to mandatory public auth variables", () => {
  const keys = [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_AUTH_MODE",
    "VITE_AUTH_PROVIDER_ALLOWLIST",
  ];
  function scan(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(path);
        continue;
      }
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(path, "utf8");
      for (const key of keys) {
        assert.ok(!source.includes(`import.meta.env["${key}"]`), path);
        assert.ok(!source.includes(`import.meta.env['${key}']`), path);
      }
    }
  }
  scan(fileURLToPath(new URL("../src/", import.meta.url)));
});
