import { expect, it } from "vitest";
import { translateBootstrap } from "./bootstrap-messages";

it("paints cinema signage with readable text instead of untranslated internal keys", () => {
  for (const kind of [
    "locker",
    "tunnel",
    "press",
    "pitch",
    "stands",
    "office",
    "arrival",
    "medical",
    "gym",
  ]) {
    for (const lang of ["pt-BR", "en"] as const) {
      for (const field of ["title", "caption"]) {
        const key = `cinemaStudio.artwork.${kind}.${field}`;
        expect(translateBootstrap(lang, key)).not.toBe(key);
        expect(translateBootstrap(lang, key).trim().length).toBeGreaterThan(3);
      }
    }
  }
});

it("renders new transport and save controls before any optional locale pack downloads", () => {
  expect(translateBootstrap("pt-BR", "match.moreControls")).toBe("Opções da partida");
  expect(translateBootstrap("en", "match.moreControls")).toBe("Match options");
  expect(translateBootstrap("pt-BR", "match.minute")).toBe("Minuto");
  expect(translateBootstrap("en", "match.possession")).toBe("Possession");
  expect(translateBootstrap("pt-BR", "shell.cloudSave")).toBe("Salvar na nuvem");
  expect(translateBootstrap("en", "nav.mobile")).toBe("Main navigation on mobile");
});
