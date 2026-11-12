import { describe, expect, it } from "vitest";
import {
  ModerationAppealInput,
  ModerationAppealReviewInput,
  ModerationCaseReviewInput,
} from "./moderation-review-input";

const user = "237b600e-68f9-44fb-9d62-10fd6c23bc83";
const request = "2a6aa49c-dc35-4bfd-8890-26ae5684240d";

describe("moderation review request validation", () => {
  it("accepts one well-formed appeal with stable client-generated idempotency ID", () => {
    const parsed = ModerationAppealInput.parse({
      caseId: user,
      requestId: request,
      message: "Solicito uma revisão humana da ocorrência e do contexto.",
    });
    expect(parsed.caseId).toBe(user);
    expect(parsed.requestId).toBe(request);
  });

  it("rejects forged identity and evidence fields before reaching the server", () => {
    const valid = {
      caseId: user,
      requestId: request,
      message: "Preciso revisar o contexto completo dessa decisão.",
    };
    for (const extra of [
      { reviewerId: user },
      { appellantId: user },
      { isModerator: true },
      { roomScore: { home: 99 } },
      { irreversibleBan: true },
    ]) {
      expect(ModerationAppealInput.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
  });

  it("requires meaningful messages and sane record identities", () => {
    expect(
      ModerationAppealInput.safeParse({
        caseId: user,
        requestId: request,
        message: "   ",
      }).success,
    ).toBe(false);
    expect(
      ModerationAppealInput.safeParse({
        caseId: "not-a-uuid",
        requestId: request,
        message: "Este é um recurso com justificativa válida.",
      }).success,
    ).toBe(false);
  });

  it("keeps case decisions bounded with a mandatory human review note", () => {
    expect(
      ModerationCaseReviewInput.safeParse({
        caseId: user,
        expectedRevision: 0,
        decision: "warning",
        note: "Examined the available evidence.",
      }).success,
    ).toBe(true);
    expect(
      ModerationCaseReviewInput.safeParse({
        caseId: user,
        expectedRevision: 0,
        decision: "permanent_ban",
        note: "Examined the available evidence.",
      }).success,
    ).toBe(false);
    expect(
      ModerationCaseReviewInput.safeParse({
        caseId: user,
        expectedRevision: -1,
        decision: "temporary_mute",
        note: "Decision based on available evidence.",
      }).success,
    ).toBe(false);
  });

  it("allows only explicit uphold or overturn appeal decisions", () => {
    const valid = { appealId: user, decision: "overturned", note: "Independent review completed." };
    expect(ModerationAppealReviewInput.safeParse(valid).success).toBe(true);
    expect(
      ModerationAppealReviewInput.safeParse({ ...valid, decision: "ignore" }).success,
    ).toBe(false);
    expect(
      ModerationAppealReviewInput.safeParse({ ...valid, reviewerId: request }).success,
    ).toBe(false);
  });
});
