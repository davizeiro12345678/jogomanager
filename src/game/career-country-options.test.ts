import { describe, expect, it } from "vitest";
import { careerCountryIdentity, careerCountryOptions } from "./career-country-options";

const country = (id: string, name: string, flag: string | null) => ({ id, country: name, flag });

describe("career country identity", () => {
  it("resolves missing flags through an unambiguous same-name region and accepts ISO2 codes", () => {
    const catalog = [
      country("legacy-br", "Brasil", null),
      country("bra", "Brasil", "🇧🇷"),
      country("missing-br", "Brasil", "🏳️"),
      country("code-br", "Brazil", "BR"),
      country("missing-en", "Brazil", ""),
    ];
    expect(careerCountryOptions(catalog)).toEqual([catalog[0]]);
    expect(careerCountryOptions(catalog, "Brazil")).toEqual([catalog[0]]);
    for (const entry of catalog) expect(careerCountryIdentity(entry, catalog)).toBe("region:br");
    expect(careerCountryIdentity(catalog[3]!)).toBe("region:br");
  });

  it("does not choose a region when identical country names describe distinct identities", () => {
    const catalog = [
      country("gb", "United Kingdom", "GB"),
      country("ni", "United Kingdom", "https://media.api-sports.io/flags/gb-nir.svg"),
      country("unknown", "United Kingdom", null),
    ];
    expect(careerCountryOptions(catalog)).toHaveLength(3);
    expect(careerCountryIdentity(catalog[0]!, catalog)).toBe("region:gb");
    expect(careerCountryIdentity(catalog[1]!, catalog)).toBe("region:gb-nir");
    expect(careerCountryIdentity(catalog[2]!, catalog)).toBe("name:united kingdom");
  });

  it("deduplicates API translations and hyphenated names while preserving bundled IDs", () => {
    const catalog = [
      country("bra", "Brasil", "🇧🇷"),
      country("bra2", "Brasil", "🇧🇷"),
      country("alb", "Albânia", "🇦🇱"),
      country("arm", "Armênia", "🇦🇲"),
      country("aus", "Austrália", "🇦🇺"),
      country("atg", "Antígua e Barbuda", "🇦🇬"),
      country("api-br", "Brazil", "https://media.api-sports.io/flags/br.svg"),
      country("api-al", "Albania", "https://media.api-sports.io/flags/al.svg"),
      country("api-am", "Armenia", "https://media.api-sports.io/flags/am.svg"),
      country("api-au", "Australia", "https://media.api-sports.io/flags/au.svg"),
      country("api-ag", "Antigua-And-Barbuda", "https://media.api-sports.io/flags/ag.svg"),
      country("api-ag2", "Antigua and Barbuda", "https://media.api-sports.io/flags/ag.svg"),
    ];
    expect(careerCountryOptions(catalog).map((entry) => entry.id)).toEqual([
      "bra",
      "alb",
      "atg",
      "arm",
      "aus",
    ]);
    expect(careerCountryOptions(catalog, "Brazil")).toEqual([catalog[0]]);
    expect(careerCountryOptions(catalog, "antigua and barbuda")).toEqual([catalog[5]]);
    expect(careerCountryOptions(catalog, "armenia")).toEqual([catalog[3]]);
    expect(careerCountryIdentity(catalog[0]!)).toBe(careerCountryIdentity(catalog[6]!));
    expect(catalog[6]!.country).toBe("Brazil");
  });

  it("keeps distinct countries when their flags are empty, generic or arbitrary URLs", () => {
    const catalog = [
      country("a", "World", ""),
      country("b", "International", ""),
      country("c", "Test country", "🏳️"),
      country("d", "Other country", "🏳️"),
      country("e", "First", "https://example.com/flags/br.svg"),
      country("f", "Second", "https://example.com/flags/br.svg"),
    ];
    expect(careerCountryOptions(catalog)).toHaveLength(catalog.length);
    expect(careerCountryIdentity(catalog[4]!)).not.toBe(careerCountryIdentity(catalog[5]!));
  });

  it("preserves UK football associations as separate identities", () => {
    const england = country(
      "eng",
      "Inglaterra",
      "🏴\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}",
    );
    const scotland = country(
      "sco",
      "Escócia",
      "🏴\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}",
    );
    const wales = country(
      "wls",
      "País de Gales",
      "🏴\u{e0067}\u{e0062}\u{e0077}\u{e006c}\u{e0073}\u{e007f}",
    );
    const importedEngland = country(
      "api-eng",
      "England",
      "https://media.api-sports.io/flags/gb-eng.svg",
    );
    expect(careerCountryOptions([england, scotland, wales, importedEngland])).toHaveLength(3);
    expect(careerCountryIdentity(england)).toBe(careerCountryIdentity(importedEngland));
    expect(careerCountryIdentity(england)).not.toBe(careerCountryIdentity(scotland));
  });
});
