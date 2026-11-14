import { describe, expect, it } from "vitest";
import { SUPPORT_CATEGORIES, SupportTicketInput } from "./support-input";

const request = {
  requestId: "8534946c-d202-4b0b-a2ce-f39b35c181e3",
  category: "gameplay",
  subject: "Partida travou",
  message: "A partida travou durante o segundo tempo.",
};

describe("support request boundary", () => {
  it("normalizes visible text and accepts the supported categories", () => {
    for (const category of SUPPORT_CATEGORIES) {
      expect(
        SupportTicketInput.parse({ ...request, category, subject: "  Partida\0 travou  " }).subject,
      ).toBe("Partida travou");
    }
  });
  it.each(["userId", "email", "webhookUrl", "status", "delivered", "leaseToken"])(
    "rejects caller-controlled %s",
    (field) => {
      expect(SupportTicketInput.safeParse({ ...request, [field]: "forged" }).success).toBe(false);
    },
  );
  it("rejects oversized, invisible, malformed and unsupported inputs", () => {
    for (const value of [
      null,
      [],
      { ...request, requestId: "bad" },
      { ...request, category: "admin" },
      { ...request, subject: "a".repeat(121) },
      { ...request, subject: " ".repeat(5) },
      { ...request, message: " ".repeat(20) },
      { ...request, message: "a".repeat(4001) },
      { ...request, message: "\u200b".repeat(50) },
    ]) {
      expect(SupportTicketInput.safeParse(value).success).toBe(false);
    }
  });
});
