import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";

import { StripeCheckoutFrame } from "@/components/StripeCheckoutFrame";
import { getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface StripeEmbeddedCheckoutProps {
  productKey: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ productKey, returnUrl }: StripeEmbeddedCheckoutProps) {
  const createSession = useServerFn(createCheckoutSession);
  // Reuse one opaque attempt ID when embedded checkout retries a request.
  const [attemptId] = useState(() => crypto.randomUUID());
  const fetchClientSecret = useCallback(async () => {
    const result = await createSession({
      data: {
        productKey,
        attemptId,
        clientEnvironment: getStripeEnvironment(),
        returnUrl:
          returnUrl ?? `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      },
    });
    if ("error" in result) throw new Error(result.error);
    return result.clientSecret;
  }, [attemptId, createSession, productKey, returnUrl]);

  return <StripeCheckoutFrame fetchClientSecret={fetchClientSecret} />;
}
