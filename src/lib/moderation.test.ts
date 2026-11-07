import { describe, expect, it } from "vitest";

import { containsProfanity, moderateMessage } from "./moderation";
import { muteUntil } from "./chat-penalties";

describe("chat moderation", () => {
  it("catches disguised offensive words", () => {
    for (const text of [
      "porra",
      "P0RR4",
      "poooorraaa",
      "p.o.r.r.a",
      "seu filho-da-puta",
      "c@r@lho",
    ])
      expect(containsProfanity(text)).toBe(true);
  });

  it("does not flag ordinary football talk", () => {
    for (const text of [
      "Que golaço do Flamengo!",
      "computador",
      "o Palmeiras condenou o lance",
      "Pedro marcou",
      "A Nigéria vai ganhar",
      "o Níger jogou bem",
      "Qual a cor nova do uniforme?",
      "vou comer daqui a pouco",
      "o técnico pode retardar a saída de bola",
    ])
      expect(containsProfanity(text)).toBe(false);
  });

  it("still catches glued and split offensive spellings", () => {
    for (const text of ["seucaralho", "vsfdcaralho", "que otarios", "filhodaputa"])
      expect(containsProfanity(text)).toBe(true);
  });

  it("does not treat goal reactions with extra letters as repeats", () => {
    expect(moderateMessage("gol", ["goool", "boa"])).toBeNull();
    expect(moderateMessage("kkk", ["kkkkk"])).toBeNull();
    expect(moderateMessage("gol", ["GOL", "boa"])).toBe("repeated");
  });

  it("blocks links, contacts, shouting and repeats", () => {
    expect(moderateMessage("entra em discord.gg/abc")).toBe("link");
    expect(moderateMessage("visita www.golpe.xyz")).toBe("link");
    expect(moderateMessage("me chama no (11) 98765-4321")).toBe("contact");
    expect(moderateMessage("mail joao@gmail.com")).toBe("contact");
    expect(moderateMessage("QUE JOGO HORRIVEL HOJE")).toBe("shouting");
    expect(moderateMessage("GOL!")).toBeNull();
    expect(moderateMessage("bom jogo", ["Bom jogo!!"])).toBe("repeated");
  });
});

describe("progressive chat mutes", () => {
  const now = Date.UTC(2026, 10, 3, 12);
  const min = 60_000;
  it("mutes 10 minutes at the 3rd infraction and 24 hours at the 5th", () => {
    expect(muteUntil([now - 2 * min, now - min], now)).toBeNull();
    expect(muteUntil([now - 2 * min, now - min, now], now)).toBe(now + 10 * min);
    const five = [0, 1, 2, 3, 4].map((i) => now - i * min);
    expect(muteUntil(five, now)).toBe(now + 24 * 60 * min);
  });
  it("blocks permanently at 10 and forgets infractions older than 7 days", () => {
    expect(
      muteUntil(
        Array.from({ length: 10 }, (_, i) => now - i * min),
        now,
      ),
    ).toBe(Number.POSITIVE_INFINITY);
    const old = now - 8 * 24 * 60 * min;
    expect(muteUntil([old, old, old], now)).toBeNull();
  });
});
