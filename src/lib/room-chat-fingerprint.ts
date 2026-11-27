import { normalizeForModeration } from "./moderation";

/** Same comparison as moderateMessage's repeat rule; the body is never persisted. */
export async function roomChatFingerprints(roomId: string, text: string) {
  const digest = async (value: string) =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
    )
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  const repeatKey = normalizeForModeration(text).replace(/[^a-z]/g, "");
  return {
    payloadHash: await digest(JSON.stringify([roomId, text])),
    repeatFingerprint: repeatKey ? await digest(repeatKey) : null,
  };
}
