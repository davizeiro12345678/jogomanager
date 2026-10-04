import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20261004135914_multiplayer_server_authority.sql",
    import.meta.url,
  ),
  "utf8",
);
const functionsSource = await readFile(
  new URL("./multiplayer.functions.ts", import.meta.url),
  "utf8",
);
const routeSource = await readFile(new URL("../routes/multiplayer.tsx", import.meta.url), "utf8");

describe("server-managed multiplayer results", () => {
  it("revokes direct room mutations and keeps the seed table server-only", () => {
    expect(migration).toMatch(/DROP POLICY IF EXISTS "Participants update the room"/);
    expect(migration).toMatch(
      /REVOKE INSERT, UPDATE, DELETE ON TABLE public\.match_rooms FROM authenticated/,
    );
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.match_room_secrets/);
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.match_room_secrets FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toMatch(/GRANT ALL ON TABLE public\.match_room_secrets TO service_role/);
  });

  it("retires legacy client-managed rooms and erases their public seeds", () => {
    expect(migration).toMatch(
      /UPDATE public\.match_rooms[\s\S]*?server_seeded IS FALSE AND status <> 'done'/,
    );
    expect(migration).toMatch(/SET seed = ''[\s\S]*?server_seeded IS FALSE AND seed <> ''/);
    expect(migration).toMatch(
      /DELETE FROM public\.match_room_secrets[\s\S]*?rooms\.server_seeded IS FALSE/,
    );
  });

  it("checks host ownership before reading the private seed and never publishes it", () => {
    const start = functionsSource.slice(
      functionsSource.indexOf("export const startMatchRoom"),
      functionsSource.indexOf("export const leaveMatchRoom"),
    );
    expect(start.indexOf("currentRoom.host_id !== context.userId")).toBeGreaterThanOrEqual(0);
    expect(start.indexOf("currentRoom.host_id !== context.userId")).toBeLessThan(
      start.indexOf('.from("match_room_secrets")'),
    );
    expect(start).not.toMatch(/seed:\s*secret\.seed/);
  });

  it("uses a public presentation seed and replaces the displayed score with server replay", () => {
    expect(routeSource).toContain('seed: ["multiplayer-view", room.id].join(":")');
    expect(routeSource).not.toContain("seed: room.seed");
    expect(routeSource).toContain("authoritativeResult.current = true");
    expect(routeSource).toContain(
      "setSnap({ minute: room.minute, hg: homeGoals, ag: awayGoals, finished: true })",
    );
  });
});
