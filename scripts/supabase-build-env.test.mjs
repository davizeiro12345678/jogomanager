import { test } from "node:test";
import assert from "node:assert/strict";
import { publicSupabaseBuildEnv } from "./supabase-build-env.mjs";

const value = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example_fixture",
};

test("injects public server Supabase configuration into Vite client builds", () => {
  assert.deepEqual(publicSupabaseBuildEnv(value), {
    VITE_SUPABASE_URL: value.SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: value.SUPABASE_PUBLISHABLE_KEY,
  });
});
test("allows consistent explicit Vite values", () => {
  assert.deepEqual(
    publicSupabaseBuildEnv({
      ...value,
      VITE_SUPABASE_URL: value.SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: value.SUPABASE_PUBLISHABLE_KEY,
    }),
    {
      VITE_SUPABASE_URL: value.SUPABASE_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: value.SUPABASE_PUBLISHABLE_KEY,
    },
  );
});
test("rejects divergent browser and server project URLs", () => {
  assert.throws(
    () =>
      publicSupabaseBuildEnv({
        ...value,
        VITE_SUPABASE_URL: "https://another.supabase.co",
      }),
    /project.*match/i,
  );
});
test("rejects divergent browser and server publishable keys", () => {
  assert.throws(
    () =>
      publicSupabaseBuildEnv({
        ...value,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_different",
      }),
    /key.*match/i,
  );
});
test("rejects missing build credentials instead of silently building a broken login", () => {
  assert.throws(() => publicSupabaseBuildEnv({}), /SUPABASE_URL/);
  assert.throws(
    () => publicSupabaseBuildEnv({ SUPABASE_URL: value.SUPABASE_URL }),
    /SUPABASE_PUBLISHABLE_KEY/,
  );
});
test("rejects server-secret keys from the public bundle", () => {
  assert.throws(
    () =>
      publicSupabaseBuildEnv({
        ...value,
        SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture_never_public",
      }),
    /secret key/i,
  );
});
