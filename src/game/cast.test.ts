import { describe, expect, it } from "vitest";

import { SPEAKER_LABEL, type Speaker } from "@/content/cutscenes";
import { castFor, speakerName } from "./cast";

const ALL: Speaker[] = [
  "manager",
  "president",
  "press",
  "captain",
  "narrator",
  "commentator",
  "referee",
  "assistant",
  "doctor",
  "scout",
  "agent",
  "fan",
];

describe("cast", () => {
  it("cobre todos os locutores, com nome e rosto", () => {
    const cast = castFor("fla", 1, "Davi");
    for (const who of ALL) {
      expect(cast[who].name).toBeDefined();
      expect(cast[who].look).toBeDefined();
    }
    expect(cast.narrator.name).toBe("");
  });

  it("usa o nome real do treinador", () => {
    expect(castFor("fla", 1, "Davi").manager.name).toBe("Davi");
  });

  it("é determinístico por clube+temporada", () => {
    const a = castFor("cor", 2, "Davi");
    const b = castFor("cor", 2, "Outro");
    expect(a.president.name).toBe(b.president.name);
    expect(a.agent.name).toBe(b.agent.name);
  });

  it("renova o elenco entre temporadas", () => {
    const a = castFor("cor", 1, "Davi");
    const b = castFor("cor", 2, "Davi");
    const same = ALL.every((w) => a[w].name === b[w].name);
    expect(same).toBe(false);
  });

  it("speakerName: override > elenco > cargo", () => {
    const cast = castFor("fla", 1, "Davi");
    expect(speakerName(cast, SPEAKER_LABEL, "captain", { captain: "Gabigol" })).toBe("Gabigol");
    expect(speakerName(cast, SPEAKER_LABEL, "president")).toBe(cast.president.name);
    expect(speakerName(undefined, SPEAKER_LABEL, "doctor")).toBe("Médico");
  });
});
