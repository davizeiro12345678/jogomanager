import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  failStorage: false,
  purchase: { reference: "cs_purchase", status: "pending", error: null as string | null },
}));
vi.mock("./store-products.server", async (original) => ({
  ...(await original<typeof import("./store-products.server")>()),
  getStoreServiceSupabase: () => ({
    from: () => ({
      update: (values: { status: string; error: string }) => ({
        eq: (field: string, reference: string) => ({
          neq: async (statusField: string, excludedStatus: string) => {
            if (deps.failStorage) return { error: { message: "connection unavailable" } };
            if (field !== "reference" || statusField !== "status")
              throw new Error("invalid filter");
            if (reference === deps.purchase.reference && deps.purchase.status !== excludedStatus) {
              Object.assign(deps.purchase, values);
            }
            return { error: null };
          },
        }),
      }),
    }),
  }),
}));

import { markPurchaseFailed } from "./fulfillment.server";

beforeEach(() => {
  deps.failStorage = false;
  deps.purchase = { reference: "cs_purchase", status: "pending", error: null };
});

describe("payment failure persistence", () => {
  it("propagates a persistence failure so the signed webhook can retry instead of acknowledging a lost update", async () => {
    deps.failStorage = true;
    await expect(markPurchaseFailed("cs_purchase", "Pagamento recusado")).rejects.toThrow();
    expect(deps.purchase.status).toBe("pending");
  });

  it("records a failed pending purchase while preserving a completed delivery", async () => {
    await markPurchaseFailed("cs_purchase", "Pagamento recusado");
    expect(deps.purchase).toMatchObject({ status: "failed", error: "Pagamento recusado" });
    deps.purchase.status = "completed";
    deps.purchase.error = null;
    await markPurchaseFailed("cs_purchase", "Evento antigo");
    expect(deps.purchase).toMatchObject({ status: "completed", error: null });
  });
});
