import { containsProfanity } from "@/lib/moderation";
import { hasVisibleText, normalizePublicText } from "@/lib/untrusted-json";

export function parseRoomChatMessage(
  payload: unknown,
): { id: string; from: string; text: string } | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  if (
    typeof value["id"] !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(value["id"]) ||
    typeof value["from"] !== "string" ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(value["from"]) ||
    typeof value["text"] !== "string" ||
    value["text"].length > 200
  )
    return null;
  const text = normalizePublicText(value["text"]);
  if (!hasVisibleText(text) || containsProfanity(text)) return null;
  return { id: value["id"], from: value["from"], text };
}
