import { sessionMeetsMfa } from "./mfa-session";

type AuthReader = {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string; factors?: { status: string }[] } | null };
      error: unknown;
    }>;
  };
};

/** Claims must already be cryptographically verified by the request middleware. */
export async function requireVerifiedMfaSession(
  client: AuthReader,
  token: string,
  claims: { sub: string; aal?: unknown },
): Promise<void> {
  // No additional Auth round trip for an already verified second factor.
  if (claims.aal === "aal2") return;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || data.user.id !== claims.sub)
    throw new Error("Unauthorized: Invalid session");
  if (!sessionMeetsMfa(claims.aal, data.user.factors))
    throw new Error("Unauthorized: MFA verification required");
}
