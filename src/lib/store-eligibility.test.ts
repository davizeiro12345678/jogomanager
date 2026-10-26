import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assertCheckoutProductNonPayToWin } from "./entitlement-contract";
import { isStoreCheckoutAllowed } from "./store-eligibility";
import { StoreCheckoutAction } from "@/components/store/StoreCheckoutAction";

const cosmetic = { key: "theme_pack", kind: "cosmetic", coins: 0 };
const empty = { coins: 0, scoutReports: 0, trainingBoosts: 0, themes: ["premium_gold"] };

describe("store purchase eligibility", () => {
  it.each([
    [{ key: "coins_small", kind: "coins", coins: 500 }, false],
    [{ key: "scout_pack", kind: "scout", coins: 0 }, false],
    [{ key: "training_pack", kind: "training", coins: 0 }, false],
    [{ key: "season_pass", kind: "cosmetic", coins: 0 }, false],
    [{ key: "pass_monthly", kind: "pass", coins: 0 }, false],
    [{ ...cosmetic, coins: 500 }, false],
    [{ ...cosmetic, coins: Number.NaN }, false],
    [cosmetic, true],
  ] as const)("advertises checkout only for publicly eligible products: %j", (product, allowed) => {
    expect(isStoreCheckoutAllowed(product)).toBe(allowed);
  });

  it.each([
    [{ ...empty, coins: 50 }, false],
    [{ ...empty, scoutReports: 1 }, false],
    [{ ...empty, trainingBoosts: 1 }, false],
    [empty, true],
  ] as const)(
    "keeps mixed private benefits subject to the same authoritative policy: %j",
    (contents, allowed) => {
      expect(isStoreCheckoutAllowed({ ...cosmetic, coins: contents.coins, contents })).toBe(
        allowed,
      );
      const authoritative = () => assertCheckoutProductNonPayToWin({ ...cosmetic, contents });
      if (allowed) expect(authoritative).not.toThrow();
      else expect(authoritative).toThrow();
    },
  );

  it("renders an unavailable action and integrity explanation instead of a legacy purchase invitation", () => {
    const html = renderToStaticMarkup(
      createElement(StoreCheckoutAction, {
        product: { key: "coins_small", kind: "coins", coins: 500 },
        children: createElement("button", null, "Comprar agora"),
      }),
    );
    expect(html).toContain("Venda indisponível");
    expect(html).toContain("disabled");
    expect(html).toContain("integridade das competições");
    expect(html).not.toContain("Comprar agora");
  });

  it("preserves the legitimate cosmetic purchase action", () => {
    const html = renderToStaticMarkup(
      createElement(StoreCheckoutAction, {
        product: cosmetic,
        children: createElement("button", null, "Comprar agora"),
      }),
    );
    expect(html).toContain("Comprar agora");
    expect(html).not.toContain("Venda indisponível");
    expect(html).not.toContain("disabled");
  });
});
