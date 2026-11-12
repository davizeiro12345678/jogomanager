import { z } from "zod";
import { hasVisibleText, normalizePublicText } from "./untrusted-json";

export const OpenModerationCaseInput = z
  .object({
    ticketId: z.string().uuid(),
    roomId: z.string().uuid(),
    subjectId: z.string().uuid(),
  })
  .strict();

export const ModerationAppealInput = z
  .object({
    caseId: z.string().uuid(),
    requestId: z.string().uuid(),
    message: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(20).max(2000))
      .refine(hasVisibleText),
  })
  .strict();

export const ModerationCaseReviewInput = z
  .object({
    caseId: z.string().uuid(),
    expectedRevision: z.number().int().min(0).max(1000),
    decision: z.enum(["dismissed", "warning", "temporary_mute"]),
    note: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(10).max(1000))
      .refine(hasVisibleText),
  })
  .strict();

export const ModerationAppealReviewInput = z
  .object({
    appealId: z.string().uuid(),
    decision: z.enum(["upheld", "overturned"]),
    note: z
      .string()
      .transform(normalizePublicText)
      .pipe(z.string().min(10).max(1000))
      .refine(hasVisibleText),
  })
  .strict();

export type ModerationReviewResult =
  | { ok: true; status: string; id?: string }
  | { ok: false; reason: "unavailable" | "verification_required" | "not_allowed" | "conflict" };
