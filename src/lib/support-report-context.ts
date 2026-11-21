/**
 * Minimal report context transported to the existing authenticated support
 * ticket form. The room ID alone is not evidence or a membership assertion.
 */
const ROOM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function reportRoomFromSearch(search: string): string | null {
  try {
    const roomId = new URLSearchParams(search).get("reportRoom");
    return roomId && ROOM_ID.test(roomId) ? roomId.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function reportPrefill(roomId: string | null) {
  if (!roomId || !ROOM_ID.test(roomId)) return null;
  return {
    category: "report" as const,
    subject: "Denúncia de comportamento no multiplayer",
    message: [
      `Sala: ${roomId.toLowerCase()}`,
      "Tipo de ocorrência: descreva aqui o que aconteceu.",
      "Horário aproximado, lance ou mensagem envolvida: ",
      "Não compartilhe dados de contato do outro jogador nem informações privadas.",
    ].join("\n"),
  };
}
