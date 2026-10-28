import { containsProfanity } from "@/lib/moderation";
import { hasVisibleText, normalizePublicText } from "@/lib/untrusted-json";

export type RoomChatMessage = { id: string; from: string; text: string; createdAt: string };

export function parseRoomChatRow(row: unknown): RoomChatMessage | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const value = row as Record<string, unknown>;
  const message = parseRoomChatMessage({
    id: value["id"],
    from: value["sender_id"],
    text: value["body"],
  });
  const createdAt = value["created_at"];
  if (
    !message ||
    typeof createdAt !== "string" ||
    createdAt.length > 40 ||
    !Number.isFinite(Date.parse(createdAt))
  )
    return null;
  return { ...message, createdAt };
}

export function mergeRoomChatMessages(
  existing: RoomChatMessage[],
  incoming: RoomChatMessage[],
): RoomChatMessage[] {
  const byId = new Map([...existing, ...incoming].map((message) => [message.id, message]));
  return [...byId.values()]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-40);
}

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
