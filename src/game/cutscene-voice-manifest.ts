import { SCENE_LIST, type Cutscene, type CutsceneLine, type Speaker } from "@/content/cutscenes";
import { validateVisemeTrack, type TimedViseme } from "./cutscene-visemes";

export interface CutsceneVoiceAsset {
  sceneId: string;
  lineId: string;
  locale: "pt-BR";
  speaker: Speaker;
  /** Immutable same-origin file under public/audio/cutscenes/pt-BR/. */
  src: string;
  durationMs: number;
  /** License or performer release record kept with the audio asset. */
  licenseRef: string;
  visemes: readonly TimedViseme[];
}

/**
 * Recordings are intentionally supplied by the project owner. Keep this list
 * empty until a licensed clip and its authored viseme track are available.
 * Missing entries use the existing browser/host voice fallback.
 */
export const CUTSCENE_VOICE_MANIFEST: readonly CutsceneVoiceAsset[] = [];

export interface CutsceneDialogueEntry {
  sceneId: string;
  lineId: string;
  speaker: Speaker;
  line: CutsceneLine;
  branch: boolean;
}

function appendLines(
  sceneId: string,
  lines: readonly CutsceneLine[],
  branch: boolean,
  into: CutsceneDialogueEntry[],
) {
  for (const line of lines) {
    if (line.id) into.push({ sceneId, lineId: line.id, speaker: line.who, line, branch });
    for (const choice of line.choices ?? []) appendLines(sceneId, choice.response, true, into);
  }
}

export function cutsceneDialogueInventory(scenes: readonly Cutscene[] = SCENE_LIST) {
  const entries: CutsceneDialogueEntry[] = [];
  for (const scene of scenes) appendLines(scene.id, scene.lines, false, entries);
  return entries;
}

export function cutsceneVoiceKey(sceneId: string, lineId: string) {
  return `${sceneId}|${lineId}`;
}

const manifestByKey = new Map(
  CUTSCENE_VOICE_MANIFEST.map((asset) => [cutsceneVoiceKey(asset.sceneId, asset.lineId), asset]),
);

export function cutsceneVoiceFor(sceneId: string, lineId: string | undefined) {
  return lineId ? (manifestByKey.get(cutsceneVoiceKey(sceneId, lineId)) ?? null) : null;
}

export interface CutsceneVoiceAudit {
  expectedCount: number;
  assetCount: number;
  missing: readonly CutsceneDialogueEntry[];
  errors: readonly string[];
}

/** Check the whole authored script, including every choice response. */
export function auditCutsceneVoiceManifest(
  scenes: readonly Cutscene[] = SCENE_LIST,
  assets: readonly CutsceneVoiceAsset[] = CUTSCENE_VOICE_MANIFEST,
): CutsceneVoiceAudit {
  const errors: string[] = [];
  const inventory: CutsceneDialogueEntry[] = [];
  const validLineKeys = new Set<string>();
  let expectedCount = 0;

  for (const scene of scenes) {
    const lineIds = new Set<string>();
    const choiceIds = new Set<string>();
    const visit = (lines: readonly CutsceneLine[], branch: boolean) => {
      for (const line of lines) {
        expectedCount++;
        if (!line.id?.trim()) {
          errors.push(`${scene.id}: dialogue line is missing a stable id`);
        } else if (lineIds.has(line.id)) {
          errors.push(`${scene.id}: duplicate dialogue id ${line.id}`);
        } else {
          lineIds.add(line.id);
          validLineKeys.add(cutsceneVoiceKey(scene.id, line.id));
          inventory.push({ sceneId: scene.id, lineId: line.id, speaker: line.who, line, branch });
        }
        for (const choice of line.choices ?? []) {
          if (!choice.id?.trim()) errors.push(`${scene.id}: choice is missing a stable id`);
          else if (choiceIds.has(choice.id))
            errors.push(`${scene.id}: duplicate choice id ${choice.id}`);
          else choiceIds.add(choice.id);
          visit(choice.response, true);
        }
      }
    };
    visit(scene.lines, false);
  }

  const seenAssets = new Set<string>();
  for (const asset of assets) {
    const key = cutsceneVoiceKey(asset.sceneId, asset.lineId);
    if (seenAssets.has(key)) errors.push(`${key}: duplicate voice asset`);
    seenAssets.add(key);
    if (!validLineKeys.has(key)) errors.push(`${key}: voice asset does not match an authored line`);
    const line = inventory.find((entry) => cutsceneVoiceKey(entry.sceneId, entry.lineId) === key);
    if (line && line.speaker !== asset.speaker)
      errors.push(`${key}: speaker does not match its line`);
    if (asset.locale !== "pt-BR")
      errors.push(`${key}: only pt-BR is configured for this recording pass`);
    if (
      !asset.src.startsWith("/audio/cutscenes/pt-BR/") ||
      asset.src.includes("..") ||
      !/\.mp3$/iu.test(asset.src)
    ) {
      errors.push(`${key}: audio must be a local pt-BR MP3 file`);
    }
    if (!asset.licenseRef.trim()) errors.push(`${key}: licenseRef is required`);
    for (const issue of validateVisemeTrack(asset.visemes, asset.durationMs)) {
      errors.push(`${key}: ${issue}`);
    }
  }

  return {
    expectedCount,
    assetCount: assets.length,
    missing: inventory.filter(
      (entry) => !seenAssets.has(cutsceneVoiceKey(entry.sceneId, entry.lineId)),
    ),
    errors,
  };
}
