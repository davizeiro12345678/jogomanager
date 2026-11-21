import { describe, expect, it } from "vitest";
import { resolveFootballPublicEnvironment } from "./football-public-env.server";

describe("public football server environment", () => {
  it("uses Worker bindings over stale process variables and excludes private bindings", () => {
    expect(
      resolveFootballPublicEnvironment(
        {
          SUPABASE_URL: "https://worker.example",
          SUPABASE_PUBLISHABLE_KEY: "worker-public-key",
          SUPABASE_SERVICE_ROLE_KEY: "must-not-be-returned",
        },
        { SUPABASE_URL: "https://stale.example", SUPABASE_PUBLISHABLE_KEY: "stale-key" },
      ),
    ).toEqual({
      SUPABASE_URL: "https://worker.example",
      SUPABASE_PUBLISHABLE_KEY: "worker-public-key",
    });
  });

  it("falls back for missing or empty Worker bindings in Node previews", () => {
    const node = {
      SUPABASE_URL: "https://preview.example",
      SUPABASE_PUBLISHABLE_KEY: "preview-key",
    };
    expect(resolveFootballPublicEnvironment(undefined, node)).toEqual(node);
    expect(
      resolveFootballPublicEnvironment({ SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: null }, node),
    ).toEqual(node);
  });
});
