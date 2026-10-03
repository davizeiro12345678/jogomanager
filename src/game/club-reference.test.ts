import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Crest } from "../components/game/Crest";
import { CLUBS, LEAGUES } from "./data/leagues";
import { safeClub } from "./club-reference";
import { safeClub as squadClub } from "./squad";
import type { Club } from "./types";

describe("clubs displayed in quick selection", () => {
  it("keeps the canonical visual data and object for every selectable club", () => {
    expect(squadClub).toBe(safeClub);
    for (const league of LEAGUES) {
      for (const club of league.clubs) {
        expect(safeClub(club.id), `${league.id}/${club.id}`).toBe(CLUBS[club.id]);
      }
    }
    expect(safeClub("fla").name).toBe("Flamengo");
    expect(safeClub("fla").primary).toBe("#c52613");
    expect(safeClub("pal").name).toBe("Palmeiras");
  });

  it("continues showing editor-created club names, colours and live edits", () => {
    const club: Club = {
      id: "private-quick-reference-test",
      name: "Meu Clube Particular",
      short: "MCP",
      league: "custom-quick-reference-test",
      primary: "#102030",
      secondary: "#fafafa",
      strength: 77,
    };
    CLUBS[club.id] = club;
    try {
      expect(safeClub(club.id)).toBe(club);
      const crest = renderToStaticMarkup(createElement(Crest, { club: safeClub(club.id) }));
      expect(crest).toContain('aria-label="Escudo do Meu Clube Particular"');
      expect(crest).toContain('stop-color="#102030"');
      club.name = "Meu Clube Renomeado";
      club.primary = "#abcdef";
      club.strength = 91;
      expect(safeClub(club.id).name).toBe("Meu Clube Renomeado");
      expect(safeClub(club.id).primary).toBe("#abcdef");
      expect(safeClub(club.id).strength).toBe(91);
    } finally {
      delete CLUBS[club.id];
    }
  });

  it("renders a guest crest when an unknown club id is restored", () => {
    const club = safeClub("missing-quick-club");
    expect(club).toEqual({
      id: "missing-quick-club",
      name: "Clube convidado",
      short: "CVD",
      league: "bra",
      primary: "#c9d2dc",
      secondary: "#1d2733",
      strength: 68,
    });
    const crest = renderToStaticMarkup(createElement(Crest, { club }));
    expect(crest).toContain('aria-label="Escudo do Clube convidado"');
    expect(crest).toContain('stop-color="#c9d2dc"');
  });
});
