import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

import worker, { MatchRoomDO } from "./worker";

describe("cooperative Worker routing", () => {
  it("routes only explicitly enabled staging traffic to the separate namespace", async () => {
    const room = "11afad22-c972-40cb-ab23-1b5ff625cb0f";
    const route = new Request(`https://staging.jogomanager.com/cooperative/rooms/${room}/socket`, {
      headers: { upgrade: "websocket", origin: "https://staging.jogomanager.com" },
    });
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const idFromName = vi.fn((name: string) => name);
    const env = {
      MATCH_AUTHORITY_ENV: "staging",
      MATCH_AUTHORITY_ENABLED: "true",
      MATCH_COOPERATIVE_AUTHORITY_ENABLED: "true",
      MATCH_TICKET_SIGNING_SECRET: "separate-staging-singles-signing-key",
      MATCH_RECEIPT_SIGNING_SECRET: "separate-staging-receipts-signing-key",
      MATCH_COOPERATIVE_TICKET_SIGNING_SECRET: "separate-staging-cooperative-signing-key",
      SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "isolated-staging-supabase-key",
      STAGING_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      ALLOWED_ORIGIN: "https://staging.jogomanager.com",
      COOPERATIVE_ROOMS: { idFromName, get: () => ({ fetch }) },
    };
    expect((await worker.fetch(route, env as never)).status).toBe(204);
    expect(idFromName).toHaveBeenCalledWith(room);
    expect(
      (await worker.fetch(route, { ...env, MATCH_COOPERATIVE_AUTHORITY_ENABLED: "false" } as never))
        .status,
    ).toBe(404);
    expect(
      (
        await worker.fetch(route, {
          ...env,
          MATCH_AUTHORITY_ENV: "production",
          SUPABASE_URL: "https://lguqnwvsfeefxamzeyos.supabase.co",
          ALLOWED_ORIGIN: "https://jogomanager.com",
        } as never)
      ).status,
    ).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("authoritative room connection admission", () => {
  it("rejects the ninth concurrent upgrade while room loading is pending and releases failed reservations", async () => {
    const room = new MatchRoomDO({} as never, { ALLOWED_ORIGIN: "https://test.example" } as never);
    let fail!: (reason?: unknown) => void;
    const load = new Promise<void>((_resolve, reject) => {
      fail = reject;
    });
    vi.spyOn(room as never, "ensureLoaded").mockImplementation(() => load);
    const request = () =>
      new Request("https://test.example/rooms/11afad22-c972-40cb-ab23-1b5ff625cb0f/socket", {
        headers: { upgrade: "websocket", origin: "https://test.example" },
      });
    const pending = Array.from({ length: 8 }, () => room.fetch(request()));
    expect((await room.fetch(request())).status).toBe(403);
    fail(new Error("load failed"));
    expect((await Promise.all(pending)).map((response) => response.status)).toEqual(
      Array(8).fill(503),
    );
    expect((await room.fetch(request())).status).toBe(503);
  });
});
