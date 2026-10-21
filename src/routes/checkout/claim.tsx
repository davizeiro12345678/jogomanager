import { createFileRoute } from "@tanstack/react-router";

import { ClaimGuestCheckout } from "@/pages/checkout/claim";

function validIntent(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function validSession(value: unknown): value is string {
  return typeof value === "string" && /^cs_[a-zA-Z0-9_]+$/.test(value);
}

export const Route = createFileRoute("/checkout/claim")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { intent?: string; session_id?: string } => ({
    ...(validIntent(search["intent"]) ? { intent: search["intent"] } : {}),
    ...(validSession(search["session_id"]) ? { session_id: search["session_id"] } : {}),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: ClaimGuestCheckout,
});
