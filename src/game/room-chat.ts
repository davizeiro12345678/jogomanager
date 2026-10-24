export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function readRoomMessage(value: unknown, roomId: string): RoomMessage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    v["room_id"] !== roomId ||
    typeof v["id"] !== "string" ||
    !UUID.test(v["id"]) ||
    typeof v["user_id"] !== "string" ||
    !UUID.test(v["user_id"]) ||
    typeof v["body"] !== "string" ||
    v["body"].length > 200 ||
    !v["body"].trim() ||
    typeof v["created_at"] !== "string" ||
    !Number.isFinite(Date.parse(v["created_at"]))
  )
    return null;
  return {
    id: v["id"],
    room_id: roomId,
    user_id: v["user_id"],
    body: v["body"],
    created_at: v["created_at"],
  };
}
export function mergeRoomMessages(
  current: readonly RoomMessage[],
  incoming: readonly RoomMessage[],
) {
  const messages = new Map(current.map((m) => [m.id, m]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id))
    .slice(-40);
}
