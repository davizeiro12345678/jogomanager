import { describe, expect, it } from "vitest";
import { careerValue, parseOfferContents } from "./store-value";

const contents = (
  c: Partial<{ coins: number; scoutReports: number; trainingBoosts: number; themes: string[] }>,
) => parseOfferContents({ coins: 0, scoutReports: 0, trainingBoosts: 0, themes: [], ...c });

describe("store career value", () => {
  it("values items at the in-game exchange rates (150 per report, 400 per boost)", () => {
    expect(
      careerValue("training", contents({ scoutReports: 3, trainingBoosts: 10 })).coinEquivalent,
    ).toBe(4450);
    expect(careerValue("coins", contents({ coins: 250, scoutReports: 1 })).coinEquivalent).toBe(
      400,
    );
  });
  it("explains that each boost is one week of +25% evolution and +5 recovery", () => {
    const training = careerValue("training", contents({ trainingBoosts: 10 })).benefits[0]!;
    expect(training.title).toBe("10 semanas de treino turbinado");
    expect(training.detail).toContain("+25%");
    expect(training.detail).toContain("+5");
  });
  it("counts five young prospects per scout report", () => {
    expect(careerValue("scout", contents({ scoutReports: 15 })).benefits[0]!.detail).toContain(
      "75 jovens",
    );
  });
  it("season pass is 300 coins a week, about 1200 a month", () => {
    const pass = careerValue("pass", null);
    expect(pass.benefits[0]!.title).toBe("300 moedas por semana");
    expect(pass.coinEquivalent).toBe(1200);
  });
  it("marks cosmetics as appearance-only", () => {
    const value = careerValue("cosmetic", contents({ coins: 150, themes: ["stadium_tifo"] }));
    expect(value.benefits.find((b) => b.kind === "cosmetic")!.detail).toContain(
      "não altera resultados",
    );
  });
});

describe("store headline", () => {
  it("leads with the dominant item: scouting pack talks about talent", () => {
    expect(
      careerValue("scout", parseOfferContents({ scoutReports: 15, trainingBoosts: 1 })).headline,
    ).toBe("Encontra talentos antes dos rivais.");
  });
});
