import { describe, expect, it } from "vitest";

import { containsProfanity } from "./moderation";

describe("chat moderation", () => {
  it.each([
    "Isso é uma porra",
    "Seu p0rr4",
    "Seu p.o.r.r.a",
    "f d p",
    "cara\u200blho",
    "filho da puta",
    "pau no cu",
    "eu vou te matar",
    "vou matar você",
    "I will kill you",
    "gays merecem morrer",
  ])("rejects an insult, threat or hate expression: %s", (text) => {
    expect(containsProfanity(text)).toBe(true);
  });

  it.each([
    "A disputa foi ótima",
    "Esse jogador é gay",
    "Respeito às pessoas negras",
    "O time é de Scunthorpe",
    "Foi um gol assustador",
    "Boa partida, pessoal!",
  ])("allows ordinary football or identity-related text: %s", (text) => {
    expect(containsProfanity(text)).toBe(false);
  });
});
