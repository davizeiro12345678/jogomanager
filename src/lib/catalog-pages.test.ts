import { expect, it } from "vitest";
import { catalogPages } from "./catalog-pages";
import { catalogCountryNames } from "./catalog-country";
it("loads every page with at most three active requests and stable result order", async () => {
  let active = 0,
    maximum = 0;
  const result = await catalogPages(2050, 100, async (offset, end) => {
    active++;
    maximum = Math.max(maximum, active);
    await Promise.resolve();
    active--;
    return Array.from({ length: Math.min(2050 - offset, end - offset + 1) }, (_, i) => offset + i);
  });
  expect(maximum).toBeLessThanOrEqual(3);
  expect(result).toHaveLength(2050);
  expect(result[2049]).toBe(2049);
});
it("rejects truncated catalog pages instead of publishing a partial catalog", async () => {
  await expect(catalogPages(2001, 1000, async () => [])).rejects.toThrow("catalog_page_incomplete");
});
it("unifies country labels from emoji, API flags and English without changing club ids", () => {
  const country = catalogCountryNames([
    { country: "Albânia", flag: "🇦🇱" },
    { country: "Brasil", flag: "🇧🇷" },
    { country: "Holanda", flag: "🇳🇱" },
  ]);
  expect(country("Albania", "https://media.api-sports.io/flags/al.svg")).toBe("Albânia");
  expect(country("Brazil", "")).toBe("Brasil");
  expect(country("Netherlands", "NL")).toBe("Holanda");
  expect(country("England", "")).toBe("Inglaterra");
});
