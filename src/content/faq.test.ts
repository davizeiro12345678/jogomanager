import { describe, expect, it } from "vitest";

import { FAQ_COUNT, FAQ_GROUPS, faqPageLd, searchFaq } from "./faq";

describe("FAQ", () => {
  it("has at least 60 questions across 8 themes", () => {
    expect(FAQ_GROUPS).toHaveLength(8);
    expect(FAQ_COUNT).toBeGreaterThanOrEqual(60);
  });

  it("indexes exactly the visible questions and answers", () => {
    const ld = JSON.parse(faqPageLd().children) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    const visible = FAQ_GROUPS.flatMap((g) => g.questions);
    expect(ld.mainEntity.map((q) => q.name)).toEqual(visible.map((q) => q.q));
    expect(ld.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(visible.map((q) => q.a));
  });

  it("search ignores accents and case", () => {
    const results = searchFaq("NÚVEM sincronizacao");
    expect(results.some((g) => g.id === "salvamento")).toBe(true);
    expect(searchFaq("xyzzy-nada")).toHaveLength(0);
  });
});
