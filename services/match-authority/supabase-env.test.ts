import { describe, expect, it } from "vitest";
import { validateAuthorityDatabaseTarget, type AuthorityDatabaseEnv } from "./supabase";

const serviceKey = "testing-local-only-no-real-privileges-123456789";
const makeEnv = (
  url: string,
  role: AuthorityDatabaseEnv["MATCH_AUTHORITY_ENV"],
): AuthorityDatabaseEnv => ({
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  MATCH_AUTHORITY_ENV: role,
});

describe("match authority database isolation", () => {
  it("rejects the production project from staging even with a valid service key", () => {
    expect(() =>
      validateAuthorityDatabaseTarget(
        makeEnv("https://lguqnwvsfeefxamzeyos.supabase.co", "staging"),
      ),
    ).toThrow(/environment/);
  });

  it("allows only the production project for the production Worker", () => {
    expect(() =>
      validateAuthorityDatabaseTarget(
        makeEnv("https://lguqnwvsfeefxamzeyos.supabase.co", "production"),
      ),
    ).not.toThrow();
    expect(() =>
      validateAuthorityDatabaseTarget(
        makeEnv("https://jogomanager-staging.supabase.co", "production"),
      ),
    ).toThrow(/environment/);
  });

  it("allows a different staging project and rejects untrusted hosts", () => {
    const staging = makeEnv("https://jogomanager-staging.supabase.co", "staging");
    expect(validateAuthorityDatabaseTarget(staging).hostname).toBe(
      "jogomanager-staging.supabase.co",
    );
    for (const url of [
      "http://jogomanager-staging.supabase.co",
      "https://jogomanager-staging.supabase.co.evil.test",
      "https://evil@example.supabase.co",
      "https://jogomanager-staging.supabase.co/admin",
      "https://jogomanager-staging.supabase.co?token=secret",
      "https://not-supabase.co",
    ]) {
      expect(() => validateAuthorityDatabaseTarget(makeEnv(url, "staging"))).toThrow();
    }
  });

  it("requires an explicit deployment identity to avoid accidental DB mixing", () => {
    const broken = {
      ...makeEnv("https://jogomanager-staging.supabase.co", "staging"),
      MATCH_AUTHORITY_ENV: "unknown",
    } as unknown as AuthorityDatabaseEnv;
    expect(() => validateAuthorityDatabaseTarget(broken)).toThrow(/environment/);
  });
});
