import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CREATOR } from "@/content/creator";

const aboutSource = readFileSync(new URL("../pages/sobre.tsx", import.meta.url), "utf8");
const managerSource = readFileSync(new URL("../pages/jogo-de-manager-de-futebol.tsx", import.meta.url), "utf8");

describe("páginas públicas e identidade do criador", () => {
  it("não carrega o catálogo volumoso na página Sobre", () => {
    expect(aboutSource).not.toContain("@/game/data/leagues");
    expect(aboutSource).not.toContain("BUNDLED_LEAGUES");
    expect(aboutSource).toContain("Qual modo combina com o seu objetivo?");
  });

  it("mostra canais consistentes sem misturar perfil pessoal e convite público", () => {
    expect(CREATOR.secondaryEmail).toBe("davithomazini779@gmail.com");
    expect(CREATOR.discordUsername).toBe("davizeiro10");
    expect(CREATOR.discordDisplayName).toBe("Davi");
  });

  it("possui tópicos concretos com hierarquia de H2 a H5", () => {
    expect(managerSource).toContain('id="manager-treinamento"');
    for (const tag of ["h2", "h3", "h4", "h5"]) {
      expect(managerSource).toContain(`<${tag}`);
    }
  });
});
