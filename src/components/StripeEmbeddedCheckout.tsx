import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import { StripeCheckoutFrame } from "@/components/StripeCheckoutFrame";
import { getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface StripeEmbeddedCheckoutProps {
  productKey: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ productKey, returnUrl }: StripeEmbeddedCheckoutProps) {
  const createSession = useServerFn(createCheckoutSession);
  const fetchClientSecret = useCallback(async () => {
    const result = await createSession({
      data: {
        productKey,
        clientEnvironment: getStripeEnvironment(),
        returnUrl:
          returnUrl ?? `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    return result.clientSecret;
  }, [createSession, productKey, returnUrl]);

  return <StripeCheckoutFrame fetchClientSecret={fetchClientSecret} />;
}
