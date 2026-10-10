import { describe, expect, it } from "vitest";

import { summarizeAthleteCareer, summarizeCoachCareer } from "./career-hub";
import type { PlayerCareerState } from "./player-career/types";

describe("career hub summaries", () => {
  it("uses the durable manager profile and makes a dismissed coach distinct", () => {
    const summary = summarizeCoachCareer({
      clubId: "unknown-club",
      managerName: "Nome antigo",
      season: 4,
      round: 12,
      sacked: true,
      manager: {
        name: "Marina Souza",
        country: "bra",
        age: 38,
        favClub: "unknown-club",
        personality: "motivador",
        reputation: 3,
        approval: 65,
        look: { skin: 1, hair: 1, hairColor: "#2b1d14", beard: 0, outfit: 0 },
        attrs: { attack: 6, defense: 6, market: 6, squad: 6, media: 6 },
      },
    });

    expect(summary).toMatchObject({
      managerName: "Marina Souza",
      clubName: "Clube não identificado",
      season: 4,
      round: 12,
      active: false,
      status: "Disponível para um novo clube",
    });
  });

  it("keeps an empty athlete slot empty and preserves the saved athlete context", () => {
    expect(summarizeAthleteCareer(null, 2)).toBeNull();

    const athlete = {
      nickname: "Rafa",
      name: "Rafael Silva",
      clubId: "unknown-club",
      position: "MEI",
      age: 20,
      season: 2,
      week: 7,
      retired: true,
      attrs: { passe: 72, finalizacao: 66, visao: 75 },
    } as unknown as PlayerCareerState;

    expect(summarizeAthleteCareer(athlete, 1)).toMatchObject({
      slot: 1,
      athleteName: "Rafa",
      clubName: "Clube não identificado",
      position: "Meia",
      age: 20,
      season: 2,
      week: 7,
      retired: true,
    });
  });

  it("does not manufacture a card when there is no coach career", () => {
    expect(summarizeCoachCareer(null)).toBeNull();
  });
});
