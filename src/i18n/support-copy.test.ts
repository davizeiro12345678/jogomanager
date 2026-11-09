import { describe, expect, it } from "vitest";
import { CREATOR, SUPPORT_UPDATED_AT } from "@/content/creator";
import { getSupportCopy, formatSupportCharacterCount } from "./support-copy";
import { getSupportPageCopy, formatSupportUpdatedDate } from "./support-page-copy";
import { supportContentLocale, supportCopyLanguage } from "./support-locale";

describe("support localization", () => {
  it("provides non-empty, matching Portuguese and English keys for every form and public state", () => {
    for (const read of [getSupportCopy, getSupportPageCopy]) {
      const pt = read("pt-BR");
      const en = read("en");
      expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
      for (const value of [...Object.values(pt), ...Object.values(en)]) {
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
    expect(getSupportCopy("pt-BR").submit).toBe("Enviar ao suporte");
    expect(getSupportCopy("en").submit).toBe("Send to support");
    expect(getSupportCopy("pt-BR").unavailable).not.toBe(getSupportCopy("en").unavailable);
    expect(getSupportCopy("pt-BR").rateLimited).not.toBe(getSupportCopy("en").rateLimited);
    expect(getSupportCopy("pt-BR").privacyPolicy).toBe("Política de privacidade");
    expect(getSupportCopy("en").privacyPolicy).toBe("Privacy policy");
  });

  it("uses Portuguese for both Portuguese variants and explicitly falls back to English otherwise", () => {
    for (const lang of ["pt", "pt-BR", "pt-PT"]) {
      expect(supportCopyLanguage(lang)).toBe("pt");
      expect(getSupportCopy(lang)).toBe(getSupportCopy("pt-BR"));
      expect(getSupportPageCopy(lang)).toBe(getSupportPageCopy("pt-BR"));
    }
    for (const lang of ["en", "en-US", "es", "fr", "ar", "zh-CN", "unknown", ""]) {
      expect(supportCopyLanguage(lang)).toBe("en");
      expect(supportContentLocale(lang)).toBe("en");
      expect(getSupportCopy(lang)).toBe(getSupportCopy("en"));
      expect(getSupportPageCopy(lang)).toBe(getSupportPageCopy("en"));
    }
    expect(supportContentLocale("pt-PT")).toBe("pt-PT");
    expect(supportContentLocale("pt-BR")).toBe("pt-BR");
  });

  it("formats character count and the fixed public date in the copy locale with no unresolved placeholders", () => {
    expect(formatSupportCharacterCount("pt-BR", 1234)).toBe(
      "1.234/4.000 caracteres; mínimo de 20.",
    );
    expect(formatSupportCharacterCount("en", 1234)).toBe("1,234/4,000 characters; minimum 20.");
    expect(formatSupportCharacterCount("fr", 1234)).toBe(formatSupportCharacterCount("en", 1234));
    expect(formatSupportCharacterCount("pt-BR", 0)).not.toContain("{count}");
    expect(SUPPORT_UPDATED_AT).toBe("2026-11-08");
    expect(formatSupportUpdatedDate("pt-BR")).toBe("8 de novembro de 2026");
    expect(formatSupportUpdatedDate("en")).toBe("November 8, 2026");
    expect(formatSupportUpdatedDate("ar")).toBe(formatSupportUpdatedDate("en"));
  });

  it("translates creator labels and origin while retaining supplied identity values verbatim", () => {
    expect(CREATOR.address).toBe("Av. Hugo Viola, 351 - Jardim da Penha, Vitória - ES, 29065-475");
    expect(CREATOR.cpf).toBe("170.312.897-42");
    expect(getSupportPageCopy("pt-BR").origin).toBe(
      "O projeto foi criado em Vitória, Espírito Santo, Brasil.",
    );
    expect(getSupportPageCopy("en").origin).toBe(
      "The project was created in Vitória, Espírito Santo, Brazil.",
    );
    expect(getSupportPageCopy("pt-BR").creatorCpfLabel).toBe("CPF do criador");
    expect(getSupportPageCopy("en").creatorLabel).toBe("Creator and developer");
  });
});
