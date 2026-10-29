import { describe, expect, it } from "vitest";
import { safeAuthNext } from "./auth-next";
import { guestCheckoutAuthRedirect } from "./guest-checkout-redirect";

describe("guest checkout authentication callback", () => {
  it("uses the allowed auth route and retains the exact claim identifiers", () => {
    const intent = "intent/a?&+%";
    const session = "cs_test_a/b?&+%";
    const redirect = new URL(guestCheckoutAuthRedirect("https://jogomanager.com", intent, session));
    expect(redirect.origin).toBe("https://jogomanager.com");
    expect(redirect.pathname).toBe("/auth");
    const next = safeAuthNext(redirect.searchParams.get("next"));
    expect(next).toBeDefined();
    const claim = new URL(next!, redirect.origin);
    expect(claim.pathname).toBe("/checkout/claim");
    expect(claim.searchParams.get("intent")).toBe(intent);
    expect(claim.searchParams.get("session_id")).toBe(session);
    expect([...claim.searchParams.keys()]).toEqual(["intent", "session_id"]);
  });
});
