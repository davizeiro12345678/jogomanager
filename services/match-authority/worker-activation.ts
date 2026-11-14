import { validateAuthorityDatabaseTarget, type AuthorityDatabaseEnv } from "./supabase";

/**
 * Reject an accidentally enabled Worker before any room Durable Object or
 * Supabase query is reached. Staging can never target the production database,
 * and credentials must be provisioned outside the repository.
 */
export interface MatchAuthorityActivationEnv extends AuthorityDatabaseEnv {
  MATCH_AUTHORITY_ENABLED: string;
  MATCH_TICKET_SIGNING_SECRET?: string;
  MATCH_RECEIPT_SIGNING_SECRET?: string;
  ALLOWED_ORIGIN?: string;
}

export function validateMatchAuthorityActivation(env: MatchAuthorityActivationEnv): void {
  if (env.MATCH_AUTHORITY_ENABLED !== "true") throw new Error("match authority is disabled");

  validateAuthorityDatabaseTarget(env);
  const origin =
    env.MATCH_AUTHORITY_ENV === "staging"
      ? "https://staging.jogomanager.com"
      : "https://jogomanager.com";
  if (env.ALLOWED_ORIGIN !== origin)
    throw new Error("match authority browser origin does not match deployment");

  const ticket = env.MATCH_TICKET_SIGNING_SECRET;
  const receipt = env.MATCH_RECEIPT_SIGNING_SECRET;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    typeof ticket !== "string" ||
    ticket.trim().length < 32 ||
    typeof receipt !== "string" ||
    receipt.trim().length < 32 ||
    ticket === receipt ||
    typeof service !== "string" ||
    service.length < 20
  )
    throw new Error("match authority signing or database credentials are missing");
}
