import { describe, expect, it } from "vitest";
import { resolveSupabaseServerConfiguration } from "./client.server";

describe("server-only Supabase environment resolution", () => {
  it("prefers Cloudflare secret bindings over stale process.env", () => {
    const resolved = resolveSupabaseServerConfiguration(
      {
        SUPABASE_URL: "https://production.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-only-binding",
        UNRELATED_SECRET: "must-not-propagate",
      },
      {
        SUPABASE_URL: "https://stale.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "wrong-node-secret",
      },
    );
    expect(resolved).toEqual({
      SUPABASE_URL: "https://production.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-binding",
    });
    expect(JSON.stringify(resolved)).not.toContain("must-not-propagate");
  });

  it("falls back to Node preview when native bindings are absent", () => {
    const node = {
      SUPABASE_URL: "https://preview.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "preview-only-secret",
    };
    expect(resolveSupabaseServerConfiguration(undefined, node)).toEqual(node);
    expect(
      resolveSupabaseServerConfiguration(
        { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: null },
        node,
      ),
    ).toEqual(node);
  });
});
