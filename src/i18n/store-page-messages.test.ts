import { describe, expect, it } from "vitest";
import { storePageMessages } from "./store-page-messages";

describe("store page copy", () => {
  it("preserves the Brazilian Portuguese storefront", () => {
    const copy = storePageMessages("pt-BR");
    expect(copy.backToPanel).toBe("Painel");
    expect(copy.title).toBe("Loja");
    expect(copy.securePayment).toBe("Pagamento seguro");
    expect(copy.instantDelivery).toBe("Entrega imediata");
    expect(copy.bonusAllPackages).toBe("Bônus em todo pacote");
  });

  it("shows a consistent English hero alongside the localized account notice", () => {
    const copy = storePageMessages("en");
    expect(copy.backToPanel).toBe("Dashboard");
    expect(copy.title).toBe("Store");
    expect(copy.securePayment).toBe("Secure payments");
    expect(copy.subtitle).toContain("season pass");
  });

  it("uses the established Spanish and legacy-language fallbacks", () => {
    expect(storePageMessages("es").title).toBe("Tienda");
    expect(storePageMessages("fr").title).toBe("Store");
  });
});
