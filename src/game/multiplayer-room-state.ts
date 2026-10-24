/** Preserve the running view while settlement changes the room state. */
export function shouldShowLiveRoom(room: { status: string; state: unknown }): boolean {
  if (room.status === "live" || room.status === "settling") return true;
  if (room.status !== "done" || !room.state || typeof room.state !== "object") return false;
  const state = room.state as Record<string, unknown>;
  return [state["hg"], state["ag"]].every(
    (score) => typeof score === "number" && Number.isInteger(score) && score >= 0,
  );
}
