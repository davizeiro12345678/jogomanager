import { describe, expect, it } from "vitest";
import {
  API_FOOTBALL_PHASES,
  apiFootballPlayerId,
  apiFootballProfileProjection,
  isApiFootballPhase,
  isFootballStaffRole,
} from "./apifootball-phases";
describe("28 category import contract", () => {
  it("exposes exactly 28 distinct supported phases and rejects prototype names", () => {
    expect(new Set(API_FOOTBALL_PHASES).size).toBe(28);
    expect(API_FOOTBALL_PHASES.every(isApiFootballPhase)).toBe(true);
    for (const value of [null, "constructor", "toString", "__proto__", "players"])
      expect(isApiFootballPhase(value)).toBe(false);
  });
  it("uses positive provider IDs for both profile formats", () => {
    expect(apiFootballPlayerId({ player: { id: 44 } })).toBe("44");
    expect(apiFootballPlayerId({ id: 45 })).toBe("45");
    for (const id of [0, -1, NaN, 1.5, "44", null]) expect(apiFootballPlayerId({ id })).toBeNull();
  });
  it("materializes only validated public profile fields with the provider identity", () => {
    expect(
      apiFootballProfileProjection({
        player: {
          id: 42,
          birth: { date: "2000-02-29" },
          photo: "https://media.example/player.png",
          nationality: "Brazil",
        },
        private: "ignored",
      }),
    ).toEqual({
      source_id: "42",
      birth_date: "2000-02-29",
      photo_url: "https://media.example/player.png",
      nationality: "Brazil",
    });
    expect(
      apiFootballProfileProjection({
        id: 42,
        birth: { date: "2001-02-29" },
        photo: "javascript:alert(1)",
      }),
    ).toEqual({ source_id: "42", birth_date: null, photo_url: null, nationality: null });
  });
  it("keeps staff out of squad imports without classifying attacking midfielders as staff", () => {
    for (const role of ["Coach", "Assistant Manager", "Goalkeeper coach", "Treinador"])
      expect(isFootballStaffRole(role)).toBe(true);
    for (const role of ["Attacker", "Midfielder", "Goalkeeper"])
      expect(isFootballStaffRole(role)).toBe(false);
  });
});
