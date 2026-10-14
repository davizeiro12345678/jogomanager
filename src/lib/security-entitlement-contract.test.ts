import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20261014210100_verified_coupon_entitlements.sql", import.meta.url),
  "utf8",
);
const guestClaim = readFileSync(new URL("./guest-checkout.functions.ts", import.meta.url), "utf8");
const couponRoute = readFileSync(new URL("./coupons.functions.ts", import.meta.url), "utf8");

describe("verified email and reward authorization contracts", () => {
  it("requires verified mailbox ownership and an explicit coupon allocation", () => {
    expect(migration).toContain("email_confirmed_at IS NOT NULL");
    expect(migration).toContain("public.coupon_eligible_users");
    expect(migration).toContain("AND e.user_id = _uid");
    expect(migration).toContain("active = false");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("FROM PUBLIC,anon");
  });

  it("never grants a purchase to a merely claimed email address", () => {
    expect(guestClaim).toContain("verifiedAccount(context.supabase, context.userId)");
    expect(guestClaim).toContain("normalizeGuestEmail(account.email)");
    expect(guestClaim).not.toContain("normalizeGuestEmail(context.claims?.email)");
  });

  it("keeps coupon redemption in the authenticated user's session", () => {
    expect(couponRoute).toContain(".middleware([requireSupabaseAuth])");
    expect(couponRoute).toContain('context.supabase.rpc("redeem_game_coupon"');
    expect(couponRoute).not.toContain("supabaseAdmin");
  });
});
