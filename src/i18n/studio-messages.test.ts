import { expect, it } from "vitest";
import { messageLanguage, translate } from "./messages";

it("keeps cinematic navigation and controls readable after loading the optional interface", () => {
  expect(translate("pt-BR", "cinemaStudio.settings")).toBe("Ajustes de exibição e encenação");
  expect(translate("pt-BR", "scene.skip")).toBe("Pular cena");
  expect(translate("en", "scene.skip")).toBe("Skip scene");
  expect(messageLanguage("pt-BR", "scene.skip")).toBe("pt-BR");
});
