import { describe, expect, it } from "vitest";

import { containsProfanity, moderateMessage, normalizeForModeration } from "./moderation";
import { muteUntil } from "./chat-penalties";

describe("chat moderation", () => {
  it("canonicalizes Unicode compatibility forms and invisible separators", () => {
    expect(normalizeForModeration("ＦＵＣＫ")).toBe("fuck");
    expect(normalizeForModeration("f\u200Bu\u200Bc\u200Bk")).toBe("fuck");
    expect(containsProfanity("ＦＵＣＫ")).toBe(true);
    expect(containsProfanity("f\u200Bu\u200Bc\u200Bk")).toBe(true);
  });

  it("matches common Unicode look-alikes without flagging a benign country name", () => {
    expect(containsProfanity("\u0441unt")).toBe(true);
    expect(containsProfanity("N\u0456ger\u0456a vai jogar hoje")).toBe(false);
  });

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

  it("blocks mixed-script phishing links and addresses while preserving football talk", () => {
    expect(moderateMessage("entra em d\u0456sc\u043erd.gg/amigos")).toBe("link");
    expect(moderateMessage("visite \u0440\u0430y\u0440\u0430l.com")).toBe("link");
    expect(moderateMessage("manda para jo\u0430o@exemplo.c\u043em")).toBe("contact");
    expect(moderateMessage("O time da N\u0456ger\u0456a virou o jogo")).toBeNull();
  });

  it("blocks contact and scam links hidden by Unicode compatibility forms and invisibles", () => {
    expect(moderateMessage("visita ｈｔｔｐｓ：／／golpe.dev")).toBe("link");
    expect(moderateMessage("visita https\u200b://golpe.dev")).toBe("link");
    expect(moderateMessage("visita golpe.store")).toBe("link");
    expect(moderateMessage("joao\u200b＠exemplo．com")).toBe("contact");
    expect(moderateMessage("１１ ９８７６５ ４３２１")).toBe("contact");
    expect(moderateMessage("11   98765   4321")).toBe("contact");
  });
});

describe("progressive chat mutes", () => {
  const now = Date.UTC(2026, 10, 3, 12);
  const min = 60_000;
  const day = 24 * 60 * min;
  it("mutes 10 minutes at the 3rd infraction and 24 hours at the 5th", () => {
    expect(muteUntil([now - 2 * min, now - min], now)).toBeNull();
    expect(muteUntil([now - 2 * min, now - min, now], now)).toBe(now + 10 * min);
    const five = [0, 1, 2, 3, 4].map((i) => now - i * min);
    expect(muteUntil(five, now)).toBe(now + day);
  });
  it("caps automated mutes at 30 days and lets them expire", () => {
    const ten = Array.from({ length: 10 }, (_, i) => now - i * min);
    const until = muteUntil(ten, now);
    expect(until).toBe(now + 30 * day);
    expect(Number.isFinite(until)).toBe(true);
    expect(muteUntil(ten, until!)).toBeNull();
  });
  it("is idempotent for the same infractions regardless of order", () => {
    const infractions = Array.from({ length: 7 }, (_, i) => now - i * min);
    expect(muteUntil(infractions, now)).toBe(muteUntil([...infractions].reverse(), now));
  });
  it("forgets infractions older than 7 days", () => {
    const old = now - 8 * 24 * 60 * min;
    expect(muteUntil([old, old, old], now)).toBeNull();
  });
});
