export interface RoomChatMembership {
  host_id: string;
  guest_id: string | null;
  status: string;
}

const CHAT_ENABLED_ROOM_STATUSES = new Set(["open", "ready", "live", "settling"]);

/** Client-side UX gate; the Realtime RLS policy remains the security boundary. */
export function canJoinRoomChat(
  membership: RoomChatMembership,
  authenticatedUserId: string | null,
): boolean {
  if (!authenticatedUserId || !CHAT_ENABLED_ROOM_STATUSES.has(membership.status)) return false;
  return membership.host_id === authenticatedUserId || membership.guest_id === authenticatedUserId;
}
