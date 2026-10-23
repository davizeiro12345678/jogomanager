import {
  assertCheckoutProductNonPayToWin,
  type CheckoutProductPolicyInput,
} from "./entitlement-contract";

export interface StoreCheckoutEligibilityInput {
  key: string;
  kind: string;
  coins: number;
  contents?: CheckoutProductPolicyInput["contents"];
}

/**
 * Public precheck using the same pure policy as the payment server. Private
 * benefits remain server-only and are checked authoritatively before Stripe.
 * When full contents are available, do not reinterpret mixed competitive grants.
 */
export function isStoreCheckoutAllowed(product: StoreCheckoutEligibilityInput): boolean {
  if (product.contents && product.contents.coins !== product.coins) return false;
  try {
    assertCheckoutProductNonPayToWin({
      key: product.key,
      kind: product.kind,
      contents: product.contents ?? {
        coins: product.coins,
        scoutReports: 0,
        trainingBoosts: 0,
        themes: [],
      },
    });
    return true;
  } catch {
    return false;
  }
}
