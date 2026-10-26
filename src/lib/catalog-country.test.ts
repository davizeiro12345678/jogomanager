import { expect, it } from "vitest";
import { catalogCountryNames, flagRegion } from "./catalog-country";

it("retains the bundled country's name when its flag is absent but incoming data supplies ISO", () => {
  const normalize = catalogCountryNames([
    { country: "Antigua and Barbuda", flag: "🏳️" },
    { country: "Antígua e Barbuda", flag: "https://media.api-sports.io/flags/ag.svg" },
  ]);
  expect(normalize("Antigua-And-Barbuda", "ag")).toBe("Antigua and Barbuda");
  expect(normalize("Antígua e Barbuda", "🇦🇬")).toBe("Antigua and Barbuda");
});

it("keeps football home nations distinct even when a provider uses a UK flag", () => {
  const normalize = catalogCountryNames([{ country: "Reino Unido", flag: "🇬🇧" }]);
  expect(normalize("England", "🇬🇧")).toBe("Inglaterra");
  expect(normalize("Scotland", "🇬🇧")).toBe("Escócia");
  expect(normalize("Wales", "🇬🇧")).toBe("País de Gales");
  expect(normalize("Northern Ireland", "🇬🇧")).toBe("Irlanda do Norte");
  expect(normalize("Example nation", "🏳️")).toBe("Example nation");
  expect(flagRegion("https://media.api-sports.io/flags/ag.svg")).toBe("AG");
});
