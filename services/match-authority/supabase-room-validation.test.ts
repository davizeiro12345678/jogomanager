import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPrivateLiveRoom, type AuthorityDatabaseEnv } from "./supabase";

const projectRef = "abcdefghijklmnopqrst";
const roomId = "12345678-1234-4123-8123-123456789012";
const hostId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const guestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const secret = "isolated-mock-only-service-key-not-a-production-credential";
const env: AuthorityDatabaseEnv = {
  SUPABASE_URL: `https://${projectRef}.supabase.co`,
  STAGING_SUPABASE_PROJECT_REF: projectRef,
  SUPABASE_SERVICE_ROLE_KEY: secret,
  MATCH_AUTHORITY_ENV: "staging",
};

const liveRoom = {
  id: roomId,
  host_id: hostId,
  guest_id: guestId,
  host_club: "ARS",
  guest_club: "CHE",
  status: "live",
  server_seeded: true,
  contact_physics_revision: 2,
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.restoreAllMocks());

describe("staging authoritative room hydration from private Supabase REST", () => {
  it("loads only a server-owned live room and its separate private seed", async () => {
    const client = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      expect(url.host).toBe(`${projectRef}.supabase.co`);
      const headers = new Headers(init?.headers);
      expect(headers.get("apikey")).toBe(secret);
      expect(headers.get("Authorization")).toBe(`Bearer ${secret}`);
      if (url.pathname === "/rest/v1/match_rooms") {
        expect(url.searchParams.get("id")).toBe(`eq.${roomId}`);
        return reply([liveRoom]);
      }
      if (url.pathname === "/rest/v1/match_room_secrets") {
        expect(url.searchParams.get("room_id")).toBe(`eq.${roomId}`);
        return reply([{ seed: "isolated_room_seed_2026_11_13" }]);
      }
      throw new Error("Unexpected private REST endpoint");
    });

    const room = await loadPrivateLiveRoom(env, roomId);
    expect(room).toEqual({
      roomId,
      homeId: hostId,
      awayId: guestId,
      homeClub: "ARS",
      awayClub: "CHE",
      seed: "isolated_room_seed_2026_11_13",
      revision: 2,
    });
    expect(client).toHaveBeenCalledTimes(2);
  });

  it("rejects non-live or forged membership before reading the private seed", async () => {
    const variants = [
      { ...liveRoom, status: "ready" },
      { ...liveRoom, server_seeded: false },
      { ...liveRoom, guest_id: hostId },
      { ...liveRoom, id: "abcdefab-abcd-4abc-8abc-abcdefabcdef" },
      { ...liveRoom, contact_physics_revision: 99 },
    ];
    for (const room of variants) {
      const client = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply([room]));
      expect(await loadPrivateLiveRoom(env, roomId)).toBeNull();
      expect(client).toHaveBeenCalledTimes(1);
      client.mockRestore();
    }
  });

  it("fails closed on unauthorized database responses without exposing credentials", async () => {
    const client = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(reply({ message: "access denied" }, 403));
    await expect(loadPrivateLiveRoom(env, roomId)).rejects.toThrow(
      "match authority database request failed: 403",
    );
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("does not fetch a room from production even if the staging reference is supplied", async () => {
    const client = vi.spyOn(globalThis, "fetch");
    await expect(
      loadPrivateLiveRoom(
        { ...env, SUPABASE_URL: "https://lguqnwvsfeefxamzeyos.supabase.co" },
        roomId,
      ),
    ).rejects.toThrow(/environment/);
    expect(client).not.toHaveBeenCalled();
  });
});
