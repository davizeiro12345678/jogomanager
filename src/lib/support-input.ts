import { z } from "zod";
import { hasVisibleText, normalizePublicText } from "./untrusted-json";

export const SUPPORT_CATEGORIES = ["gameplay", "account", "purchase", "privacy", "report"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SupportTicketInput = z
  .object({
    requestId: z.string().uuid(),
    category: z.enum(SUPPORT_CATEGORIES),
    subject: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(5).max(120))
      .refine(hasVisibleText),
    message: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(20).max(4000))
      .refine(hasVisibleText),
  })
  .strict();

export type SupportTicketRequest = z.infer<typeof SupportTicketInput>;
export type SubmitSupportTicketResult =
  | { ok: true; ticketId: string; status: "queued" | "delivered" | "delivery_failed" }
  | { ok: false; reason: "unavailable" | "rate_limited" | "verification_required" | "error" };
