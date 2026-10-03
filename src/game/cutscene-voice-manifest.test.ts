import { describe, expect, it } from "vitest";
import {
  CHOICE_SCENE_IDS,
  SCENE_LIST,
  type Cutscene,
  type CutsceneLine,
} from "@/content/cutscenes";
import {
  auditCutsceneVoiceManifest,
  cutsceneDialogueInventory,
  type CutsceneVoiceAsset,
} from "./cutscene-voice-manifest";
import { cutsceneBranch } from "./cutscene-choice";
import { directScene } from "./cutscene-director";
import { buildCutsceneTimeline, SHOTS } from "./cutscene-timeline";

describe("cutscene voice manifest", () => {
  it("assigns stable IDs to all 87 scenes and all ten choice branches", () => {
    const audit = auditCutsceneVoiceManifest();
    const inventory = cutsceneDialogueInventory();

    expect(SCENE_LIST).toHaveLength(87);
    expect(CHOICE_SCENE_IDS).toHaveLength(5);
    expect(audit.errors).toEqual([]);
    expect(audit.expectedCount).toBe(310);
    expect(inventory).toHaveLength(310);
    expect(inventory.filter((entry) => entry.branch)).toHaveLength(20);
    expect(new Set(inventory.map((entry) => `${entry.sceneId}|${entry.lineId}`)).size).toBe(310);
    expect(audit.missing).toHaveLength(310);
  });

  it("smoke-checks direction, timelines, and each response across all 87 scenes", () => {
    const sceneIds = new Set<string>();
    const dialogueIds = new Set<string>();

    for (const scene of SCENE_LIST) {
      expect(sceneIds.has(scene.id), `scene id ${scene.id}`).toBe(false);
      sceneIds.add(scene.id);

      const direction = directScene(scene);
      const timeline = buildCutsceneTimeline(scene);
      expect(direction.lines, scene.id).toHaveLength(scene.lines.length);
      expect(timeline.id).toBe(scene.id);
      expect(timeline.lines, scene.id).toHaveLength(scene.lines.length);
      expect(timeline.duration, scene.id).toBeGreaterThan(0);
      expect(timeline.lines.every((line) => SHOTS.includes(line.shot))).toBe(true);

      scene.lines.forEach((line, lineIndex) => {
        expect(line.id, `${scene.id}: stable line id`).toBeTruthy();
        expect(dialogueIds.has(line.id!), `${scene.id}: duplicate ${line.id}`).toBe(false);
        dialogueIds.add(line.id!);

        for (const [choiceIndex, choice] of (line.choices ?? []).entries()) {
          expect(choice.id, `${scene.id}: stable choice id`).toBeTruthy();
          expect(choice.response.length, `${scene.id}: choice response`).toBeGreaterThan(0);
          const branch = cutsceneBranch(scene.lines, lineIndex, choiceIndex);
          expect(
            branch?.lines.slice(lineIndex + 1, lineIndex + 1 + choice.response.length),
          ).toEqual(choice.response);
          for (const response of choice.response) {
            expect(response.id, `${scene.id}: stable response id`).toBeTruthy();
            expect(dialogueIds.has(response.id!), `${scene.id}: duplicate ${response.id}`).toBe(
              false,
            );
            dialogueIds.add(response.id!);
          }
        }
      });
    }

    expect(sceneIds.size).toBe(87);
    expect(dialogueIds.size).toBe(310);
  });

  it("accepts a licensed local recording with aligned viseme bounds", () => {
    const line: CutsceneLine = {
      id: "fixture.line.001",
      who: "manager",
      text: "Vamos!",
    };
    const scene: Cutscene = { id: "fixture", title: "Fixture", art: "press", lines: [line] };
    const asset: CutsceneVoiceAsset = {
      sceneId: "fixture",
      lineId: line.id!,
      locale: "pt-BR",
      speaker: "manager",
      src: "/audio/cutscenes/pt-BR/fixture.line.001.mp3",
      durationMs: 180,
      licenseRef: "licenses/fixture-performer-release.md",
      visemes: [
        { atMs: 0, shape: "silence" },
        { atMs: 35, shape: "U" },
        { atMs: 95, shape: "AA" },
        { atMs: 180, shape: "silence" },
      ],
    };

    expect(auditCutsceneVoiceManifest([scene], [asset])).toMatchObject({
      expectedCount: 1,
      assetCount: 1,
      missing: [],
      errors: [],
    });

    expect(
      auditCutsceneVoiceManifest(
        [scene],
        [{ ...asset, src: "/audio/cutscenes/pt-BR/fixture.line.001.ogg" }],
      ).errors,
    ).toContain("fixture|fixture.line.001: audio must be a local pt-BR MP3 file");
  });

  it("reports clip references that do not match dialogue or licensing metadata", () => {
    const asset: CutsceneVoiceAsset = {
      sceneId: "fixture",
      lineId: "fixture.line.missing",
      locale: "pt-BR",
      speaker: "manager",
      src: "/remote/voice.mp3",
      durationMs: 2,
      licenseRef: "",
      visemes: [
        { atMs: 4, shape: "AA" },
        { atMs: 3, shape: "AA" },
      ],
    };

    const audit = auditCutsceneVoiceManifest([], [asset]);
    expect(audit.errors).toEqual(
      expect.arrayContaining([
        "fixture|fixture.line.missing: voice asset does not match an authored line",
        "fixture|fixture.line.missing: audio must be a local pt-BR MP3 file",
        "fixture|fixture.line.missing: licenseRef is required",
        "fixture|fixture.line.missing: the first cue must start at 0ms",
        "fixture|fixture.line.missing: cue 0 is outside the clip duration",
        "fixture|fixture.line.missing: cue 1 is outside the clip duration",
        "fixture|fixture.line.missing: cue 1 is not strictly ordered",
        "fixture|fixture.line.missing: the final cue must return to silence",
      ]),
    );
  });
});
