export function readMultiplayerRoomQuery<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new Error("Multiplayer room query failed", { cause: result.error });
  return result.data;
}
