import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  isSettlementLeaseExpired,
  MATCH_SETTLEMENT_LEASE_MS,
  settlementLeaseCutoff,
} from "./multiplayer-settlement";

const migration = await readFile(
  new URL(
    "../../supabase/migrations/20261004161718_multiplayer_server_authority.sql",
    import.meta.url,
  ),
  "utf8",
);
const functionsSource = await readFile(
  new URL("./multiplayer.functions.ts", import.meta.url),
  "utf8",
);
const pageSource = await readFile(new URL("../pages/multiplayer.tsx", import.meta.url), "utf8");

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
    expect(pageSource).toContain('seed: ["multiplayer-view", room.id].join(":")');
    expect(pageSource).not.toContain("seed: room.seed");
    expect(pageSource).toContain("authoritativeResult.current = true");
    expect(pageSource).toContain(
      "setSnap({ minute: room.minute, hg: homeGoals, ag: awayGoals, finished: true })",
    );
  });

  it("keeps a live room mounted during a temporary browser disconnect", () => {
    const liveRoom = pageSource.indexOf('if (room && room.status === "live" && room.guest_club)');
    const offlineFallback = pageSource.indexOf("if (!online)");
    expect(liveRoom).toBeGreaterThanOrEqual(0);
    expect(liveRoom).toBeLessThan(offlineFallback);
    expect(pageSource).toContain("online={online}");
    expect(pageSource).toContain("controller.pause(document.hidden || !onlineRef.current)");
    expect(pageSource).toContain("published.current = false;");
  });

  it("claims a single settling state before replaying and protects that claim from leave", () => {
    const finish = functionsSource.slice(functionsSource.indexOf("export const finishMatchRoom"));
    const claim = finish.indexOf('status: "settling"');
    const replay = finish.indexOf("new MatchSim(");
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(claim).toBeLessThan(replay);
    expect(finish).toContain('.eq("status", "settling")');

    const leave = functionsSource.slice(
      functionsSource.indexOf("export const leaveMatchRoom"),
      functionsSource.indexOf("export const finishMatchRoom"),
    );
    expect(leave).toContain('room.status === "settling"');
  });

  it("checks leave's CAS row before deleting the private seed", () => {
    const leave = functionsSource.slice(
      functionsSource.indexOf("export const leaveMatchRoom"),
      functionsSource.indexOf("export const finishMatchRoom"),
    );
    const cas = leave.indexOf("const { data: closedRoom, error }");
    const cleanup = leave.indexOf('.from("match_room_secrets")');
    expect(cas).toBeGreaterThanOrEqual(0);
    expect(leave.slice(cas, cleanup)).toContain('.select("id")');
    expect(leave.slice(cas, cleanup)).toContain(".maybeSingle()");
    expect(leave.slice(cas, cleanup)).toContain("if (!closedRoom)");
    expect(leave.slice(cas, cleanup)).toContain('latestRoom.status === "settling"');
    expect(cleanup).toBeGreaterThan(cas);
  });

  it("reclaims a stale settlement claim only after the lease expires", () => {
    const finish = functionsSource.slice(functionsSource.indexOf("export const finishMatchRoom"));
    const now = Date.parse("2026-11-08T03:00:00.000Z");
    expect(
      isSettlementLeaseExpired(new Date(now - MATCH_SETTLEMENT_LEASE_MS - 1).toISOString(), now),
    ).toBe(true);
    expect(
      isSettlementLeaseExpired(new Date(now - MATCH_SETTLEMENT_LEASE_MS + 1).toISOString(), now),
    ).toBe(false);
    expect(finish).toContain("isSettlementLeaseExpired(room.updated_at)");
    expect(finish).toContain(
      ".or(`status.eq.live,and(status.eq.settling,updated_at.lt.${settlementLeaseCutoffAt})`)",
    );
    expect(finish).toContain('.select("id, updated_at")');
  });

  it("lets concurrent finish requests contend on one live-or-stale CAS", () => {
    const finish = functionsSource.slice(functionsSource.indexOf("export const finishMatchRoom"));
    expect(finish).toContain(
      ".or(`status.eq.live,and(status.eq.settling,updated_at.lt.${settlementLeaseCutoffAt})`)",
    );
    expect(finish).toContain("if (!claim)");
    expect(finish).toContain('latest?.status === "settling"');
  });

  it("fences a stale claimant from publishing or releasing after reclaim", () => {
    const finish = functionsSource.slice(functionsSource.indexOf("export const finishMatchRoom"));
    const release = finish.slice(finish.indexOf("const releaseClaim"));
    const publication = finish.slice(finish.indexOf("const { data: updatedRoom"));
    expect(release).toContain('.eq("updated_at", lease.currentLease())');
    expect(publication).toContain('.eq("updated_at", lease.currentLease())');
    expect(finish).toContain("const claimLease = claim.updated_at");
    expect(finish).toContain("const lease = createSettlementLeaseGuard");
    expect(finish).toContain('.eq("updated_at", expectedLease)');
    expect(finish).toContain("lease.start()");
    expect(finish).toContain("await lease.stop()");
  });

  it("renews a long local replay before its lease can be reclaimed", () => {
    const finish = functionsSource.slice(functionsSource.indexOf("export const finishMatchRoom"));
    expect(finish).toContain("if (steps % 128 === 0)");
    expect(finish).toContain("lease.isLost()");
  });

  it("allows a participant to close only an expired settlement and waits for lease expiry in UI", () => {
    const leave = functionsSource.slice(
      functionsSource.indexOf("export const leaveMatchRoom"),
      functionsSource.indexOf("export const finishMatchRoom"),
    );
    expect(leave).toContain("isSettlementLeaseExpired(room.updated_at)");
    expect(leave).toContain('.eq("status", "settling")');
    expect(leave).toContain('.lt("updated_at", settlementLeaseCutoff())');
    expect(pageSource).toContain('retryReason === "settling"');
    expect(pageSource).toContain("MATCH_SETTLEMENT_LEASE_MS + 1000");
    expect(pageSource).toContain("isSettlementLeaseExpired(room.updated_at)");
  });
});
