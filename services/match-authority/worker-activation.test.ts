import { describe, expect, it } from "vitest";
import {
  validateMatchAuthorityActivation,
  type MatchAuthorityActivationEnv,
} from "./worker-activation";

const staging: MatchAuthorityActivationEnv = {
  MATCH_AUTHORITY_ENABLED: "true",
  MATCH_AUTHORITY_ENV: "staging",
  STAGING_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fake-staging-only-api-key-123456789",
  MATCH_TICKET_SIGNING_SECRET: "local-only-ticket-signing-secret-123456789",
  MATCH_RECEIPT_SIGNING_SECRET: "local-only-receipt-signing-secret-123456789",
  ALLOWED_ORIGIN: "https://staging.jogomanager.com",
};

describe("match authority activation trust boundary", () => {
  it("allows explicitly isolated staging only with distinct signing credentials", () => {
    expect(() => validateMatchAuthorityActivation(staging)).not.toThrow();
  });

  it("rejects a staging Worker mapped to production even with the correct key", () => {
    expect(() =>
      validateMatchAuthorityActivation({
        ...staging,
        SUPABASE_URL: "https://lguqnwvsfeefxamzeyos.supabase.co",
      }),
    ).toThrow(/environment/);
  });

  it("rejects production browser origin and production key reuse in staging", () => {
    for (const mismatch of [
      { ALLOWED_ORIGIN: "https://jogomanager.com" },
      { ALLOWED_ORIGIN: "http://staging.jogomanager.com" },
      { ALLOWED_ORIGIN: "https://staging.jogomanager.com.evil.test" },
      { STAGING_SUPABASE_PROJECT_REF: "lguqnwvsfeefxamzeyos" },
      { STAGING_SUPABASE_PROJECT_REF: undefined },
    ]) {
      expect(() => validateMatchAuthorityActivation({ ...staging, ...mismatch })).toThrow();
    }
  });

  it("never activates with missing, short or reused signing credentials", () => {
    for (const mismatch of [
      { MATCH_TICKET_SIGNING_SECRET: undefined },
      { MATCH_TICKET_SIGNING_SECRET: "short" },
      { MATCH_RECEIPT_SIGNING_SECRET: undefined },
      { MATCH_RECEIPT_SIGNING_SECRET: "short" },
      { MATCH_RECEIPT_SIGNING_SECRET: staging.MATCH_TICKET_SIGNING_SECRET },
      { SUPABASE_SERVICE_ROLE_KEY: "" },
      { SUPABASE_SERVICE_ROLE_KEY: "short" },
    ]) {
      expect(() => validateMatchAuthorityActivation({ ...staging, ...mismatch })).toThrow();
    }
  });

  it("keeps disabled environments closed even when other configuration appears valid", () => {
    expect(() =>
      validateMatchAuthorityActivation({ ...staging, MATCH_AUTHORITY_ENABLED: "false" }),
    ).toThrow(/disabled/);
  });

  it("also requires the correct identity and origin for a production deployment", () => {
    const production: MatchAuthorityActivationEnv = {
      ...staging,
      MATCH_AUTHORITY_ENV: "production",
      STAGING_SUPABASE_PROJECT_REF: undefined,
      SUPABASE_URL: "https://lguqnwvsfeefxamzeyos.supabase.co",
      ALLOWED_ORIGIN: "https://jogomanager.com",
    };
    expect(() => validateMatchAuthorityActivation(production)).not.toThrow();
    expect(() =>
      validateMatchAuthorityActivation({
        ...production,
        SUPABASE_URL: staging.SUPABASE_URL,
      }),
    ).toThrow(/environment/);
  });
});
