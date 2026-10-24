import { describe, expect, it } from "vitest";
import { CUTSCENES } from "@/content/cutscenes";
import { createSponsorDealScene, createTransferDealScene } from "./business-cutscenes";
import { cutsceneBranch } from "./cutscene-choice";
import { buildCutsceneTimeline } from "./cutscene-timeline";
import { sceneSpeakerLabels, sceneText } from "./scene-localization";

const transfer = Object.freeze({
  dealId: "market-round-12-player-7",
  clubName: "Clube Real",
  managerName: "Treinador Real",
  playerName: "Atleta Real",
  agentName: "Agente Real",
  fromName: "Clube de Origem",
  feeMillion: 8.5,
  wageThousandWeekly: 35,
  shirtNumber: 19,
});
const sponsor = Object.freeze({
  dealId: "contract-season-2-round-12",
  clubName: "Clube Real",
  sponsorName: "Marca Real",
  incomeMillionWeekly: 0.25,
  currentRound: 12,
  endsRound: 30,
});
const stages = ["negotiation", "signing", "presentation"] as const;

describe("career business cinematics", () => {
  it("uses actual deal names and units without changing the catalogue or its inputs", () => {
    const catalogueKeys = Object.keys(CUTSCENES);
    const scene = createTransferDealScene(transfer, "negotiation");
    const copy = scene.lines.map((line) => line.text).join(" ");
    expect(copy).toContain("Atleta Real");
    expect(copy).toContain("Clube Real");
    expect(copy).toContain("Clube de Origem");
    expect(copy).toContain("€8,5 milhões");
    expect(copy).toContain("€35 mil por semana");
    expect(scene.speakerNames).toMatchObject({
      captain: "Atleta Real",
      agent: "Agente Real",
      manager: "Treinador Real",
    });
    expect(Object.keys(CUTSCENES)).toEqual(catalogueKeys);
    expect(transfer.feeMillion).toBe(8.5);
    expect(
      createSponsorDealScene(sponsor, "signing")
        .lines.map((line) => line.text)
        .join(" "),
    ).toContain("€0,25 milhões por semana até a rodada 30");
  });

  it("each stage has deterministic direction, distinct identities and valid lines", () => {
    const ids = new Set<string>();
    for (const stage of stages)
      for (const scene of [
        createTransferDealScene(transfer, stage),
        createSponsorDealScene(sponsor, stage),
      ]) {
        expect(ids.has(scene.id)).toBe(false);
        ids.add(scene.id);
        expect(scene.business?.stage).toBe(stage);
        expect(scene.lines.length).toBeGreaterThanOrEqual(4);
        const lines = scene.lines.flatMap((line) => [
          line,
          ...(line.choices?.flatMap((choice) => choice.response) ?? []),
        ]);
        expect(new Set(lines.map((line) => line.id)).size).toBe(lines.length);
        const timeline = buildCutsceneTimeline(scene);
        expect(timeline).toEqual(buildCutsceneTimeline(scene));
        expect(timeline.duration).toBeLessThan(90);
      }
    expect(createTransferDealScene(transfer, "signing")).toEqual(
      createTransferDealScene(transfer, "signing"),
    );
  });

  it("negotiation and announcement choices never apply a transaction or meter effect", () => {
    for (const stage of stages)
      for (const scene of [
        createTransferDealScene(transfer, stage),
        createSponsorDealScene(sponsor, stage),
      ]) {
        const original = JSON.stringify(scene);
        scene.lines.forEach((line, lineIndex) =>
          line.choices?.forEach((choice, choiceIndex) => {
            expect(choice.effect).toBeUndefined();
            const branch = cutsceneBranch(scene.lines, lineIndex, choiceIndex);
            expect(branch?.effect).toBeUndefined();
            expect(branch?.reaction).toBeUndefined();
            expect(branch?.lines.at(-1)).toBe(scene.lines.at(-1));
          }),
        );
        expect(JSON.stringify(scene)).toBe(original);
      }
  });

  it("English dialogue and speech language survive custom-scene localization", () => {
    const scene = createTransferDealScene(transfer, "presentation", "en");
    expect(scene.title).toBe("Introducing Atleta Real");
    expect(scene.lines[0]?.text).toContain("Number 19");
    expect(
      sceneText(
        scene,
        scene.lines[0],
        "en",
        (key) => key,
        () => "en",
      ),
    ).toEqual({ text: scene.lines[0]?.text, lang: "en" });
    expect(sceneSpeakerLabels("en", (key) => key, scene).captain).toBe("Atleta Real");
    const partnership = createSponsorDealScene(sponsor, "negotiation", "en");
    expect(partnership.lines.map((line) => line.text).join(" ")).toContain(
      "€0.25 million per week until round 30",
    );
    expect(partnership.lines[2]?.choices?.[0]?.label).toBe("Discuss fans and community");
  });

  it("does not claim invalid monetary inputs or unsupplied contract periods", () => {
    const scene = createSponsorDealScene(
      { ...sponsor, incomeMillionWeekly: Number.NaN, endsRound: Number.POSITIVE_INFINITY },
      "negotiation",
    );
    const copy = JSON.stringify(scene);
    expect(copy).not.toContain("NaN");
    expect(copy).not.toContain("Infinity");
    expect(copy).not.toContain("até a rodada");
  });
});
