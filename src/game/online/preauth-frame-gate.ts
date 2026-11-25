/**
 * Authentication has not completed until the authority acknowledges the
 * candidate's seat. Only handshake frames may reach the presentation reducer.
 * This deliberately does not replace the reducer's full protocol validation.
 */
export type PreAuthFrameDecision = "accept" | "ignore" | "reject_seat";

export function classifyPreAuthAuthorityFrame(
  raw: unknown,
  expectedSeat: "home" | "away",
): PreAuthFrameDecision {
  if (typeof raw !== "string" || raw.length > 64 * 1024) return "ignore";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return "ignore";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "ignore";
  const frame = parsed as Record<string, unknown>;
  if (frame["type"] === "ready")
    return frame["seat"] === expectedSeat ? "accept" : "reject_seat";
  return frame["type"] === "sequence_resume" ? "accept" : "ignore";
}
