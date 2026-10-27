import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  product: {
    key: "coins_medium",
    name: "Cofre de moedas",
    description: "1.500 moedas",
    kind: "coins",
    coins: 1500,
    price_cents: 1290,
    currency: "BRL",
    sale_percent_off: 20,
    sale_starts_at: "2026-10-02T16:58:48Z",
    sale_ends_at: "2026-11-01T16:58:48Z",
  },
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: to }, children),
    ClientOnly: ({ children }: { children: React.ReactNode }) => children,
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useCareer", () => ({ useSignedIn: () => false }));
vi.mock("@/hooks/useStoreCatalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useStoreCatalog")>()),
  useStoreCatalog: () => ({ data: [fixture.product] }),
}));
vi.mock("@/hooks/useStripeCheckout", () => ({
  useStripeCheckout: () => ({
    openCheckout: vi.fn(),
    checkoutElement: null,
    isOpen: false,
    closeCheckout: vi.fn(),
  }),
}));
vi.mock("@/components/PaymentTestModeBanner", () => ({ PaymentTestModeBanner: () => null }));
vi.mock("@/components/PublicLinks", () => ({ PublicLinks: () => null }));
vi.mock("@/components/store/VipPlansPreview", () => ({ VipPlansPreview: () => null }));

import { ProdutosPage } from "./produtos";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("shows the active discounted price alongside the original price", () => {
  vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
  const html = renderToStaticMarkup(createElement(ProdutosPage));
  expect(html).toContain("10,32");
  expect(html).toContain("12,90");
  expect(html).toContain("-20%");
});

it("does not show a discount after the sale has expired", () => {
  vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  const html = renderToStaticMarkup(createElement(ProdutosPage));
  expect(html).toContain("12,90");
  expect(html).not.toContain("10,32");
  expect(html).not.toContain("-20%");
});
