import { describe, expect, it } from "vitest";
import { careerCountries } from "./career-countries";

describe("career nationality options", () => {
  it("groups bundled, imported and flagless aliases without changing the saved league ID", () => {
    const options = careerCountries([
      { id: "bra", country: "Brasil", flag: "🇧🇷" },
      { id: "bra2", country: "Brasil", flag: "🇧🇷" },
      { id: "import-1", country: "Brazil", flag: "https://media.api-sports.io/flags/br.svg" },
      { id: "import-2", country: " BRAZIL ", flag: "" },
      { id: "import-3", country: "Czechia", flag: "" },
      { id: "cze", country: "Tchéquia", flag: "🇨🇿" },
      {
        id: "import-4",
        country: "Czech-Republic",
        flag: "https://media.api-sports.io/flags/cz.svg",
      },
    ]);
    expect(options.map(({ id, country }) => [id, country])).toEqual([
      ["bra", "Brasil"],
      ["import-3", "Tchéquia"],
    ]);
    expect(options[0]?.search).toContain("brazil");
    expect(options[1]?.search).toContain("czech republic");
  });

  it("keeps football nations separate and excludes international competition buckets", () => {
    const options = careerCountries([
      {
        id: "eng",
        country: "Inglaterra",
        flag: "🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}",
      },
      {
        id: "eng-import",
        country: "England",
        flag: "https://media.api-sports.io/flags/gb-eng.svg",
      },
      {
        id: "nir",
        country: "Northern-Ireland",
        flag: "https://media.api-sports.io/flags/gb-nir.svg",
      },
      { id: "irl", country: "Irlanda", flag: "🇮🇪" },
      { id: "intl", country: "World", flag: "" },
      { id: "uefa", country: "Europe", flag: "" },
    ]);
    expect(options.map(({ id, country }) => [id, country])).toEqual([
      ["eng", "Inglaterra"],
      ["irl", "Irlanda"],
      ["nir", "Irlanda do Norte"],
    ]);
  });
});
