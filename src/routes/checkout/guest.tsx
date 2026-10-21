import { createFileRoute } from "@tanstack/react-router";

import { GuestCheckoutReturn } from "@/pages/checkout/guest";

function validIntent(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function validSession(value: unknown): value is string {
  return typeof value === "string" && /^cs_[a-zA-Z0-9_]+$/.test(value);
}

export const Route = createFileRoute("/checkout/guest")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { intent?: string; session_id?: string } => ({
    ...(validIntent(search["intent"]) ? { intent: search["intent"] } : {}),
    ...(validSession(search["session_id"]) ? { session_id: search["session_id"] } : {}),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: GuestCheckoutReturn,
});
