import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CareerState } from "@/game/types";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock("@/game/contracts/career-transfer", () => ({
  exportCareerFile: vi.fn(),
  importCareerFile: vi.fn(),
}));
vi.mock("@/lib/offline/store", () => ({ saveLocalCareer: vi.fn() }));
import { CareerTransferPanel } from "./CareerTransferPanel";
const render = (career: CareerState | null, ready: boolean) =>
  renderToStaticMarkup(
    createElement(CareerTransferPanel, { career, ready, ownerId: null, onImport: async () => {} }),
  );
describe("career transfer access", () => {
  it("offers import on an empty resolved profile without requiring a fictitious save", () => {
    const html = render(null, true);
    expect(html).toContain("Importar carreira");
    expect(html).not.toContain("Exportar carreira");
    expect(html).toContain('type="file"');
    expect(html).toContain('aria-label="Selecionar arquivo JSON de carreira de treinador"');
    expect(html).not.toMatch(/<input[^>]+\sdisabled=""/);
    expect(html).not.toMatch(/<button[^>]+\sdisabled=""/);
    expect(html).toContain('role="status"');
    expect(html).toContain("o login não adota o save de visitante automaticamente");
  });
  it("offers both actions when a career is available and explains purchases stay with the account", () => {
    const html = render({ managerName: "Fixture" } as CareerState, true);
    expect(html).toContain("Exportar carreira");
    expect(html).toContain("Importar carreira");
    expect(html).toContain("Compras e assinatura pertencem à conta do pagamento");
    expect(html).not.toMatch(/<button[^>]+\sdisabled=""/);
  });
  it("keeps file selection disabled while authentication is unresolved", () => {
    const html = render(null, false);
    expect(html).toContain("Importar carreira");
    expect(html).toMatch(/<input[^>]+\sdisabled=""/);
    expect(html).toMatch(/<button[^>]+\sdisabled=""/);
    expect(html).toContain("Verificando a conta antes de permitir a importação");
  });
});
