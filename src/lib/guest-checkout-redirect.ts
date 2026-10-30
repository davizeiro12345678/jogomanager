/** Route email authentication through the allowed callback before claiming. */
export function guestCheckoutAuthRedirect(
  origin: string,
  intent: string,
  sessionId: string,
): string {
  const claim = `/checkout/claim?${new URLSearchParams({ intent, session_id: sessionId })}`;
  return `${origin}/auth?next=${encodeURIComponent(claim)}`;
}
