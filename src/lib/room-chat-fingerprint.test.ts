import { describe, expect, it } from "vitest";
import { moderateMessage } from "./moderation";
import { roomChatFingerprints } from "./room-chat-fingerprint";

describe("private room chat fingerprints", () => {
  const room = "10000000-0000-4000-8000-000000000001";
  it("matches the moderation repeat comparison without retaining readable bodies", async () => {
    const first = await roomChatFingerprints(room, "Boa partida!");
    const disguised = await roomChatFingerprints(room, "BÓA\u200b PARTIDA.");
    expect(moderateMessage("BÓA\u200b PARTIDA.", ["Boa partida!"])).toBe("repeated");
    expect(first.repeatFingerprint).toBe(disguised.repeatFingerprint);
    expect(first.repeatFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.payloadHash).not.toBe(disguised.payloadHash);
  });
  it("binds idempotency to exact normalized text and room while allowing emoji-only messages", async () => {
    const first = await roomChatFingerprints(room, "⚽");
    expect(first.repeatFingerprint).toBeNull();
    expect(first).toEqual(await roomChatFingerprints(room, "⚽"));
    expect(first.payloadHash).not.toBe(
      (await roomChatFingerprints("other-room", "⚽")).payloadHash,
    );
    expect(first.payloadHash).not.toBe((await roomChatFingerprints(room, "🥅")).payloadHash);
    expect((await roomChatFingerprints(room, "gol")).repeatFingerprint).not.toBe(
      (await roomChatFingerprints(room, "goool")).repeatFingerprint,
    );
  });
});
