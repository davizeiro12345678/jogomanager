import { describe, expect, it } from "vitest";

import type { CareerState, Player } from "./types";
import { applyTalk, detectUnhappy, settlePromises, talkTo } from "./unhappy";

function player(over: Partial<Player> = {}): Player {
  return {
    id: "p1",
    clubId: "fla",
    name: "Craque",
    pos: "MEI",
    age: 26,
    ovr: 80,
    morale: 70,
    condition: 90,
    wage: 100,
    value: 40,
    injuryWeeks: 0,
    suspended: false,
    number: 10,
    ...over,
  } as Player;
}

function career(over: Partial<CareerState> = {}): CareerState {
  const p1 = player();
  return {
    clubId: "fla",
    season: 1,
    round: 5,
    players: { p1 },
    lineup: ["p1"],
    bench: [],
    promises: [],
    news: [],
    ...over,
  } as CareerState;
}

describe("unhappy", () => {
  it("craque no banco reclama de minutos", () => {
    const s = career({ lineup: [] });
    const g = detectUnhappy(s);
    expect(g).toHaveLength(1);
    expect(g[0]!.reason).toBe("minutos");
    expect(g[0]!.level).toBeGreaterThanOrEqual(2);
  });

  it("titular feliz não aparece na lista", () => {
    expect(detectUnhappy(career())).toHaveLength(0);
  });

  it("oferta barrada vira mágoa", () => {
    const s = career({ rejectedOffers: ["p1"] });
    expect(detectUnhappy(s)[0]!.reason).toBe("oferta");
  });

  it("promessa quebrada é o motivo mais grave", () => {
    const s = career({ brokenPromises: ["p1"] });
    const g = detectUnhappy(s)[0]!;
    expect(g.reason).toBe("promessa");
    expect(g.level).toBe(3);
  });

  it("conversa é determinística na mesma rodada", () => {
    const s = career({ lineup: [] });
    const g = detectUnhappy(s)[0]!;
    const p = s.players[g.pid]!;
    const a = talkTo(s, p, g, "elogiar");
    const b = talkTo(s, p, g, "elogiar");
    expect(a).toEqual(b);
  });

  it("prometer com sucesso registra a promessa", () => {
    const s = career({ lineup: [] });
    const g = detectUnhappy(s)[0]!;
    const p = s.players[g.pid]!;
    const res = talkTo(s, p, g, "prometer");
    const next = applyTalk(s, p.id, "prometer", res);
    if (res.ok) {
      expect(next.promises).toHaveLength(1);
      expect(next.promises![0]!.untilRound).toBe(s.round + 3);
    } else {
      expect(next.promises).toHaveLength(0);
    }
  });

  it("liberar gera notícia de mercado", () => {
    const s = career({ lineup: [] });
    const g = detectUnhappy(s)[0]!;
    const p = s.players[g.pid]!;
    const res = talkTo(s, p, g, "liberar");
    expect(res.ok).toBe(true);
    const next = applyTalk(s, p.id, "liberar", res);
    expect(next.news[0]!.kind).toBe("mercado");
  });

  it("promessa cumprida rende moral e some da lista", () => {
    const s = career({
      promises: [{ pid: "p1", starts: 2, target: 3, untilRound: 9 }],
    });
    const next = settlePromises(s, ["p1"]);
    expect(next.promises).toHaveLength(0);
    expect(next.players["p1"]!.morale).toBeGreaterThan(70);
    expect(next.news[0]!.kind).toBe("vestiario");
  });

  it("prazo estourado quebra a promessa e derruba a moral", () => {
    const s = career({
      round: 10,
      promises: [{ pid: "p1", starts: 1, target: 3, untilRound: 9 }],
    });
    const next = settlePromises(s, []);
    expect(next.promises).toHaveLength(0);
    expect(next.brokenPromises).toContain("p1");
    expect(next.players["p1"]!.morale).toBeLessThan(70);
  });
});
