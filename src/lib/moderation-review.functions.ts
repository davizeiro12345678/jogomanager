import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OpenModerationCaseInput,
  ModerationAppealInput,
  ModerationAppealReviewInput,
  ModerationCaseReviewInput,
  type ModerationReviewResult,
} from "./moderation-review-input";

const ModeratorActionResult = z
  .object({
    status: z.enum([
      "opened",
      "already_open",
      "resolved",
      "already_resolved",
      "upheld",
      "overturned",
      "already_reviewed",
    ]),
    caseId: z.string().uuid().optional(),
    appealId: z.string().uuid().optional(),
    revision: z.number().int().nonnegative().optional(),
  })
  .strict();

function accessEnabled(): boolean {
  // Both frontend calls and server RPCs fail closed until the dedicated
  // staging DB, reviewer allowlist and operation runbook are verified.
  return process.env["MODERATION_REVIEW_ENABLED"] === "true";
}

function unavailable(error: { code?: string } | null): ModerationReviewResult {
  if (error?.code === "42501") return { ok: false, reason: "not_allowed" };
  if (["40001", "23505", "23514"].includes(error?.code ?? ""))
    return { ok: false, reason: "conflict" };
  return { ok: false, reason: "unavailable" };
}

/** A report ticket must belong to the authenticated reporter and real room. */
export const openModerationCaseFromReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => OpenModerationCaseInput.parse(input))
  .handler(async ({ data, context }): Promise<ModerationReviewResult> => {
    if (!accessEnabled()) return { ok: false, reason: "unavailable" };
    const { verifiedAccount } = await import("./verified-identity.server");
    const user = await verifiedAccount(context.supabase, context.userId);
    if (!user) return { ok: false, reason: "verification_required" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const result = await supabaseAdmin.rpc("open_private_moderation_case", {
        p_ticket: data.ticketId,
        p_room: data.roomId,
        p_subject: data.subjectId,
        p_reporter: context.userId,
      });
      if (result.error) return unavailable(result.error);
      const parsed = ModeratorActionResult.safeParse(result.data);
      return parsed.success && ["opened", "already_open"].includes(parsed.data.status)
        ? {
            ok: true,
            status: parsed.data.status,
            ...(parsed.data.caseId ? { id: parsed.data.caseId } : {}),
          }
        : { ok: false, reason: "unavailable" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });

export const submitModerationAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ModerationAppealInput.parse(input))
  .handler(async ({ data, context }): Promise<ModerationReviewResult> => {
    if (!accessEnabled()) return { ok: false, reason: "unavailable" };
    const { verifiedAccount } = await import("./verified-identity.server");
    const user = await verifiedAccount(context.supabase, context.userId);
    if (!user) return { ok: false, reason: "verification_required" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const result = await supabaseAdmin.rpc("appeal_private_moderation_case", {
        p_case: data.caseId,
        // An attacker cannot submit an arbitrary appellant identity.
        p_appellant: context.userId,
        p_request: data.requestId,
        p_message: data.message,
      });
      if (result.error) return unavailable(result.error);
      const parsed = ModeratorActionResult.safeParse(result.data);
      return parsed.success && ["opened", "already_open"].includes(parsed.data.status)
        ? {
            ok: true,
            status: parsed.data.status,
            ...(parsed.data.appealId ? { id: parsed.data.appealId } : {}),
          }
        : { ok: false, reason: "unavailable" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });

export const decideModerationCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ModerationCaseReviewInput.parse(input))
  .handler(async ({ data, context }): Promise<ModerationReviewResult> => {
    if (!accessEnabled()) return { ok: false, reason: "unavailable" };
    const { verifiedAccount } = await import("./verified-identity.server");
    const user = await verifiedAccount(context.supabase, context.userId);
    if (!user) return { ok: false, reason: "verification_required" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const result = await supabaseAdmin.rpc("resolve_private_moderation_case", {
        p_case: data.caseId,
        // SQL additionally checks this identity against private active moderators.
        p_reviewer: context.userId,
        p_revision: data.expectedRevision,
        p_decision: data.decision,
        p_note: data.note,
      });
      if (result.error) return unavailable(result.error);
      const parsed = ModeratorActionResult.safeParse(result.data);
      return parsed.success && ["resolved", "already_resolved"].includes(parsed.data.status)
        ? { ok: true, status: parsed.data.status }
        : { ok: false, reason: "unavailable" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });

export const decideModerationAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ModerationAppealReviewInput.parse(input))
  .handler(async ({ data, context }): Promise<ModerationReviewResult> => {
    if (!accessEnabled()) return { ok: false, reason: "unavailable" };
    const { verifiedAccount } = await import("./verified-identity.server");
    const user = await verifiedAccount(context.supabase, context.userId);
    if (!user) return { ok: false, reason: "verification_required" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const result = await supabaseAdmin.rpc("review_private_moderation_appeal", {
        p_appeal: data.appealId,
        // The user cannot select the reviewer of their own appeal.
        p_reviewer: context.userId,
        p_decision: data.decision,
        p_note: data.note,
      });
      if (result.error) return unavailable(result.error);
      const parsed = ModeratorActionResult.safeParse(result.data);
      return parsed.success &&
          ["upheld", "overturned", "already_reviewed"].includes(parsed.data.status)
        ? { ok: true, status: parsed.data.status }
        : { ok: false, reason: "unavailable" };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  });
