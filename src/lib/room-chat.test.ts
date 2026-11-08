import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../pages/multiplayer.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("./chat.functions.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261108013026_authorize_match_room_realtime_chat.sql",
    import.meta.url,
  ),
  "utf8",
);
const rateMigration = readFileSync(
  new URL("../../drizzle/migrations/0062_room_chat_rate_limits.sql", import.meta.url),
  "utf8",
);

describe("authoritative room chat", () => {
  it("remounts by authoritative auth identity and checks stale async identity before joining", () => {
    expect(page).toContain("const userId = useAuthUserId()");
    expect(page).toContain("<MultiplayerAccount key={userId} userId={userId} />");
    expect(page).toContain("user.id !== userId");
    expect(page).toContain("<RoomChat key={`${userId}:${room.id}`}");
    expect(page).toContain("removeChannel(ch)");
  });
  it("submits only roomId/text; server verifies token identity, membership and active state", () => {
    expect(page).toContain("sendRoomChatMessage({ data: { roomId, text: value } })");
    expect(server).toContain(".middleware([requireSupabaseAuth])");
    expect(server).toContain("room.host_id !== context.userId && room.guest_id !== context.userId");
    expect(server).toContain('["open", "ready", "live", "settling"]');
    expect(server).toMatch(/moderateMessage\([\s\S]*?data\.text/);
    expect(server).toContain("chat_infractions");
    expect(server).toContain("muteUntil(");
    expect(server).toContain("room_chat_rate_limits");
    expect(server).toContain("second_bucket: bucket");
    expect(server).toContain("/realtime/v1/api/broadcast");
    expect(server).toContain("senderId: context.userId");
    expect(server).not.toContain("data.senderId");
  });
  it("has no authenticated direct INSERT policy; private receive checks active membership and sender", () => {
    expect(migration).toMatch(/FOR SELECT TO authenticated/i);
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "Match room participants can send private chat broadcasts"/i,
    );
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*?FOR INSERT[\s\S]*?realtime\.messages/i);
    expect(migration).toMatch(/room\.host_id::text = payload ->> 'senderId'/i);
    expect(migration).toMatch(/status IN \('open', 'ready', 'live', 'settling'\)/i);
    expect(migration).not.toMatch(
      /(?:CREATE|ALTER|DROP)\s+(?:TABLE|FUNCTION|TRIGGER)\s+realtime\./i,
    );
  });
  it("stores only atomic one-second user buckets, inaccessible to browser roles", () => {
    expect(rateMigration).toMatch(/PRIMARY KEY \(user_id, second_bucket\)/i);
    expect(rateMigration).toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(rateMigration).toMatch(
      /REVOKE ALL ON public\.room_chat_rate_limits FROM PUBLIC, anon, authenticated/i,
    );
    expect(rateMigration.replace(/^--.*$/gm, "")).not.toMatch(/\b(body|text|message)\b/i);
  });
});

describe("room chat client feedback and identity", () => {
  it("classifies own broadcasts from the authenticated sender before the send response", () => {
    expect(page).toContain('m.senderId === userId ? "Você" : "Adversário"');
    expect(page).not.toContain("ownMessageIds");
  });
  it("preserves input on rejected sends and announces server/network failures accessibly", () => {
    expect(page).toContain('setText((current) => (current === value ? "" : current))');
    expect(page).toContain("result.message ??");
    expect(page).toContain('result.reason === "rate_limited"');
    expect(page).toContain('role="alert"');
    expect(page).toContain('setFeedback(t("screen.error"))');
    expect(page).not.toContain('setStatus("unavailable");\n            });');
  });
  it("uses runtime translations for loading text and keeps error strings out of JSX", () => {
    expect(page).toContain('t("common.loading")');
    expect(page).not.toContain("Verificando conta…");
  });
});
