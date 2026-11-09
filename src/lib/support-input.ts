import { z } from "zod";
import { hasVisibleText, normalizePublicText } from "./untrusted-json";

export const SUPPORT_CATEGORIES = ["career", "purchase", "account", "bug", "suggestion"] as const;
export const SupportRequestInput = z
  .object({
    requestId: z.string().uuid(),
    category: z.enum(SUPPORT_CATEGORIES),
    message: z
      .string()
      .max(4000)
      .transform(normalizePublicText)
      .pipe(z.string().min(20).max(4000))
      .refine(hasVisibleText),
    website: z.string().max(100).default(""),
  })
  .strict();

export type SupportInput = z.infer<typeof SupportRequestInput>;
export type SupportResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      reason: "unavailable" | "verification_required" | "rate_limited" | "pending" | "conflict";
    };
