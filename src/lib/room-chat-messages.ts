/** Message ids are actor-scoped in the durable admission ledger. */
export function appendRoomChatMessage<T extends { id: string; senderId: string }>(
  current: T[],
  message: T,
): T[] {
  if (
    current.some((existing) => existing.id === message.id && existing.senderId === message.senderId)
  )
    return current;
  return [...current.slice(-39), message];
}
