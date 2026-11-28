import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { storePanelMessages } from "./store-panel-messages";

describe("store panel localization", () => {
  it("actually connects checkout labels and product categories to the localized catalog", () => {
    const component = readFileSync(
      new URL("../components/game/StorePanel.tsx", import.meta.url),
      "utf8",
    );
    expect(component).toContain("const panelCopy = storePanelMessages(lang)");
    expect(component).toContain("{panelCopy.checkoutTitle}");
    expect(component).toContain("{panelCopy.retryPayments}");
    expect(component).toContain("{kindLabels[p.kind] ?? p.kind}");
    expect(component).not.toContain(">Checkout seguro</h2>");
    expect(component).not.toContain("KIND_LABELS");
  });
  it("uses consistent pt-BR copy for the checkout and category", () => {
    const copy = storePanelMessages("pt-BR");
    expect(copy.checkoutTitle).toBe("Checkout seguro");
    expect(copy.kindScout).toBe("Olheiros");
    expect(copy.retryPayments).toBe("Verificar pagamentos");
  });
  it("localizes visible statuses and category labels in English", () => {
    const copy = storePanelMessages("en");
    expect(copy.checkoutTitle).toBe("Secure checkout");
    expect(copy.kindScout).toBe("Scouting");
    expect(copy.retryPayments).toBe("Check payments");
    expect(copy.bestValue).toBe("Featured · best value");
    expect(copy.buySafely).toBe("Buy securely");
  });
  it("localizes the same purchasing workflow in Spanish", () => {
    const copy = storePanelMessages("es");
    expect(copy.checkoutTitle).toBe("Pago seguro");
    expect(copy.kindScout).toBe("Ojeadores");
    expect(copy.retryPayments).toBe("Comprobar pagos");
    expect(copy.bestValue).toBe("Destacado · mejor valor");
  });
  it("never publishes an empty panel label in pt, en or es", () => {
    for (const lang of ["pt-BR", "en", "es"] as const) {
      const strings = Object.values(storePanelMessages(lang));
      expect(strings.length).toBeGreaterThan(25);
      expect(strings.every((value) => typeof value === "string" && value.trim().length > 0)).toBe(
        true,
      );
    }
  });
});
