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

import { MatchRoomDO } from "./worker";

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
