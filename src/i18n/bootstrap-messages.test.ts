import { expect, it } from "vitest";
import { translateBootstrap } from "./bootstrap-messages";

it("renders new transport and save controls before any optional locale pack downloads", () => {
  expect(translateBootstrap("pt-BR", "match.moreControls")).toBe("Opções da partida");
  expect(translateBootstrap("en", "match.moreControls")).toBe("Match options");
  expect(translateBootstrap("pt-BR", "match.minute")).toBe("Minuto");
  expect(translateBootstrap("en", "match.possession")).toBe("Possession");
  expect(translateBootstrap("pt-BR", "shell.cloudSave")).toBe("Salvar na nuvem");
  expect(translateBootstrap("en", "nav.mobile")).toBe("Main navigation on mobile");
});
