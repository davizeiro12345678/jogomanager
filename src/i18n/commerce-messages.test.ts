import { describe, expect, it } from "vitest";
import { commerceMessages, commerceText } from "./commerce-messages";
import type { Lang } from "./locale-catalog";

describe("commerce localization", () => {
  it.each(["pt-BR", "en", "es", "fr", "de", "it", "ar", "ja"] as Lang[])(
    "has a nonempty translation for every key in %s",
    (lang) => {
      for (const key of Object.keys(commerceMessages.en) as (keyof typeof commerceMessages.en)[]) {
        expect(commerceText(lang, key).trim()).not.toBe("");
      }
    },
  );
  it("falls back to English for languages without a translated commerce pack", () => {
    expect(commerceText("ko", "coupon.redeem")).toBe("Redeem");
  });
  it("uses the Portuguese pack for pt-PT until editorial review", () => {
    expect(commerceText("pt-PT", "claim.delivered")).toBe("Item entregue");
  });
});