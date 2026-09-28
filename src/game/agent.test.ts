import { describe, expect, it } from "vitest";

import { agentConversation, agentFor, agentOpener, agentReact, moodFor } from "./agent";

describe("agent", () => {
  it("o mesmo alvo tem sempre o mesmo agente", () => {
    expect(agentFor("pid-9")).toEqual(agentFor("pid-9"));
  });

  it("gera persona, comissão e paciência válidas", () => {
    const a = agentFor("pid-10");
    expect(["mercenario", "protetor", "paciente", "estrela", "duro"]).toContain(a.persona);
    expect(a.feePct).toBeGreaterThanOrEqual(3);
    expect(a.feePct).toBeLessThanOrEqual(12);
    expect(a.patience).toBeGreaterThanOrEqual(2);
    expect(a.patience).toBeLessThanOrEqual(5);
  });

  it("aceita na hora quando a oferta cobre o pedido", () => {
    const conv = agentConversation("pid-9");
    const reply = agentReact(conv, "Craque", 1.2, 50, "seed-1");
    expect(reply.walkedAway).toBe(false);
    expect(conv.heat).toBeGreaterThan(0);
    expect(moodFor(conv.heat)).not.toBe("neutro");
  });

  it("sugere contraproposta quando a oferta chega perto", () => {
    const conv = agentConversation("pid-9");
    const reply = agentReact(conv, "Craque", 0.85, 50, "seed-2");
    expect(reply.walkedAway).toBe(false);
    expect(reply.counter).toBeDefined();
    expect(reply.counter!).toBeGreaterThan(40);
  });

  it("ofensa repetida sai da mesa", () => {
    const conv = agentConversation("pid-9");
    let walked = false;
    for (let k = 0; k < 8 && !walked; k++) {
      walked = agentReact(conv, "Craque", 0.1, 50, `off-${k}`).walkedAway;
    }
    expect(walked).toBe(true);
    expect(conv.walkedAway).toBe(true);
  });

  it("abertura cita agente, jogador e clube", () => {
    const conv = agentConversation("pid-9");
    const line = agentOpener(conv.agent, "Craque", "Flamengo");
    expect(line).toContain(conv.agent.name);
    expect(line).toContain("Craque");
  });

  it("moodFor mapeia o calor", () => {
    expect(moodFor(-3)).toBe("furioso");
    expect(moodFor(0)).toBe("neutro");
  });
});
