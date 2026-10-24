import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function bridge(fetch: typeof globalThis.fetch) {
  let handler: (request: Request) => Promise<Response>;
  const code = readFileSync(
    new URL("../../supabase/functions/sportsdb-bridge/index.ts", import.meta.url),
    "utf8",
  ).replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/records\.mjs["'];\s*/, "");
  const javascript = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  vm.runInNewContext(javascript, {
    Deno: {
      env: {
        get: (name: string) =>
          name === "SUPABASE_URL" ? "https://fixture.supabase.co" : "fixture",
      },
      serve: (fn: typeof handler) => {
        handler = fn;
      },
    },
    fetch,
    Response,
    Request,
    URL,
    URLSearchParams,
    AbortSignal,
    console: { error: vi.fn() },
    SOURCE_URL: "https://source.example/api",
    manifest: () => ({}),
    sourceComplete: () => false,
  });
  return (request: Request) => handler(request);
}
const request = (path = "") =>
  new Request(`https://fixture.supabase.co/functions/v1/sportsdb-bridge${path}`, {
    method: "POST",
    headers: { authorization: "Bearer scheduler-fixture" },
  });

describe("scheduler error disclosure", () => {
  it("rejects an invalid scheduler token without acquiring a lease", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(false));
    const response = await bridge(fetch)(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves authorized manifest/work/release when the scheduler is paused", async () => {
    const fetch = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("sportsdb_bridge_authorize")) return Response.json(true);
      if (url.endsWith("sportsdb_bridge_acquire")) return Response.json("lease_fixture");
      if (url.endsWith("sportsdb_bridge_work")) return Response.json({ paused: true });
      return Response.json({});
    });
    const response = await bridge(fetch)(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      pages: 0,
      archives: 0,
      source_complete: false,
    });
    const release = fetch.mock.calls.find((call) =>
      String(call[0]).endsWith("sportsdb_bridge_release"),
    );
    expect(JSON.parse(release?.[1].body)).toEqual({ p_owner: "lease_fixture", p_error: null });
  });
  it.each(["", "/authorize"])("sanitizes authorization RPC errors on %s", async (path) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { message: "SQL table private.payment_secrets missing", hint: "internal schema" },
          { status: 500 },
        ),
      );
    const response = await bridge(fetch)(request(path));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "SportsDB bridge failed" });
  });
  it("sanitizes a work failure even if releasing its lease also fails", async () => {
    const fetch = vi.fn().mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith("sportsdb_bridge_authorize")) return Response.json(true);
      if (url.endsWith("sportsdb_bridge_acquire")) return Response.json("lease_fixture");
      if (url.startsWith("https://source.example")) return Response.json({});
      return Response.json(
        { message: "SQL private.internal_table permission denied" },
        { status: 500 },
      );
    });
    const response = await bridge(fetch)(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "SportsDB bridge failed",
      pages: 0,
      archives: 0,
    });
    const release = fetch.mock.calls.find((call) =>
      String(call[0]).endsWith("sportsdb_bridge_release"),
    );
    expect(JSON.parse(release?.[1].body).p_error).not.toContain("private.internal_table");
  });
  it("preserves a normal paused/busy scheduler response", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async (url: string) =>
        Response.json(url.endsWith("sportsdb_bridge_authorize") ? true : null),
      );
    const response = await bridge(fetch)(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ status: "busy_or_paused" });
  });
});
