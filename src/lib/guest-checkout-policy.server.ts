import {
  assertCheckoutProductAllowed,
  type CheckoutProductPolicyInput,
} from "./entitlement-contract";

/**
 * Runs the store package policy before a guest checkout intent is read,
 * rate-limited, or persisted. The callback stays injectable so this ordering
 * is directly testable without a database or payment provider.
 */
export async function persistGuestCheckoutIntentIfAllowed<T>(
  product: CheckoutProductPolicyInput,
  persistIntent: () => Promise<T>,
): Promise<T> {
  assertCheckoutProductAllowed(product);
  return persistIntent();
}
