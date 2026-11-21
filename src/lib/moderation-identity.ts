/** Never render private moderation records unless the completed query belongs
 * to the currently authenticated account. During identity changes, fail closed.
 */
export function mayShowModerationData(
  userId: string | null | undefined,
  loadedFor: string | null,
): boolean {
  return typeof userId === "string" && userId.length > 0 && loadedFor === userId;
}
