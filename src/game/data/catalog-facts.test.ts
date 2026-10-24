import { describe, expect, it } from "vitest";
import { catalogFacts } from "./catalog-facts";

describe("catalogue identity counts", () => {
  it("counts memberships separately while retaining distinct homonymous clubs", () => {
    expect(
      catalogFacts([
        {
          id: "one",
          clubs: [
            { id: "a", name: "Vitória" },
            { id: "b", name: "Vitória" },
          ],
        },
        { id: "two", clubs: [{ id: "a", name: "Vitória" }] },
        { id: "two", clubs: [] },
      ]),
    ).toEqual({ competitions: 2, playableClubs: 2, memberships: 3 });
  });

  it("rejects blank identities and the sentinel in any Portuguese case without dropping real Unicode labels", () => {
    const names = [
      "",
      " \t ",
      "clube",
      " CLUBE ",
      "ClUbE",
      "Clube Atlético",
      "İstanbul",
      "Évora",
      "東京",
    ];
    const clubs = names.map((name, index) => ({ id: `club-${index}`, name }));
    clubs.push({ id: " \t ", name: "Real club" });
    expect(catalogFacts([{ id: "league", clubs }])).toEqual({
      competitions: 1,
      playableClubs: 4,
      memberships: 4,
    });
  });
});
