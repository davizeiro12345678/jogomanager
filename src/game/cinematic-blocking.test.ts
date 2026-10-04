import { describe, expect, it } from "vitest";
import { SCENE_LIST, type SceneArt } from "@/content/cutscenes";
import { cutsceneDialogueInventory } from "./cutscene-voice-manifest";
import { cinematicSetFor, cinematicStageActorFor, cinematicStageFocus } from "./cinematic-blocking";

describe("cinematic stage blocking contract", () => {
  it("maps every authored art to its physical set", () => {
    const expected: Record<SceneArt, string> = {
      arrival: "arrival",
      press: "press",
      dressing: "locker",
      trophy: "pitch",
      training: "pitch",
      gym: "locker",
      tactics: "locker",
      staff: "office",
      board: "office",
      transfer: "office",
      tunnel: "tunnel",
      kitroom: "locker",
      pitchentry: "pitch",
      celebration: "stands",
      defeat: "locker",
      farewell: "tunnel",
      bus: "arrival",
      office: "office",
      medical: "locker",
      gala: "press",
    };

    for (const [art, set] of Object.entries(expected) as [SceneArt, string][]) {
      expect(cinematicSetFor(art)).toBe(set);
    }
  });

  it("stages every authored non-narrated line, including every choice response", () => {
    const sceneById = new Map(SCENE_LIST.map((scene) => [scene.id, scene]));
    const entries = cutsceneDialogueInventory();
    const choiceEntries = entries.filter((entry) => entry.branch);

    // A regression that stops walking choice responses would silently lose
    // dialogue coverage while leaving all top-level lines green.
    expect(choiceEntries).toHaveLength(20);

    for (const entry of entries) {
      const scene = sceneById.get(entry.sceneId);
      expect(scene, entry.sceneId).toBeDefined();
      const actor = cinematicStageActorFor(scene!.art, entry.speaker);

      if (entry.speaker === "narrator") {
        expect(actor, `${entry.sceneId}:${entry.lineId}`).toBeNull();
        continue;
      }

      expect(actor, `${entry.sceneId}:${entry.lineId}`).not.toBeNull();
      expect(actor!.role, `${entry.sceneId}:${entry.lineId}`).toBe(entry.speaker);
      expect(actor!.set, `${entry.sceneId}:${entry.lineId}`).toBe(cinematicSetFor(scene!.art));
      expect(["resident", "overlay"]).toContain(actor!.presence);
      expect(actor!.mark).toHaveLength(2);
      expect(actor!.mark.every(Number.isFinite), `${entry.sceneId}:${entry.lineId}`).toBe(true);
    }
  });

  it("keeps a spoken role semantic when its set needs an overlay", () => {
    expect(cinematicStageActorFor("tactics", "assistant")).toMatchObject({
      role: "assistant",
      set: "locker",
      presence: "overlay",
    });
    expect(cinematicStageActorFor("transfer", "agent")).toMatchObject({
      role: "agent",
      set: "office",
      presence: "overlay",
    });
    expect(cinematicStageActorFor("staff", "scout")).toMatchObject({
      role: "scout",
      set: "office",
      presence: "overlay",
    });
    expect(cinematicStageActorFor("pitchentry", "referee")).toMatchObject({
      role: "referee",
      set: "pitch",
      presence: "overlay",
    });
    expect(cinematicStageActorFor("celebration", "fan")).toMatchObject({
      role: "fan",
      set: "stands",
      presence: "overlay",
    });
  });

  it("uses the resolved actor mark for every dialogue focus", () => {
    const sceneById = new Map(SCENE_LIST.map((scene) => [scene.id, scene]));
    for (const entry of cutsceneDialogueInventory()) {
      if (entry.speaker === "narrator") continue;
      const scene = sceneById.get(entry.sceneId)!;
      const actor = cinematicStageActorFor(scene.art, entry.speaker)!;
      expect(
        cinematicStageFocus(cinematicSetFor(scene.art), entry.speaker, scene.art),
        `${entry.sceneId}:${entry.lineId}`,
      ).toEqual(actor.mark);
    }
  });
});
