/** Authored cutscene catalog, assembled in the original stable order. */
export * from "./cutscene-types";
import type { Cutscene } from "./cutscene-types";
import { historyScenes } from "./cutscene-packs/history";
import { trainingScenes } from "./cutscene-packs/training";
import { clubRoomsScenes } from "./cutscene-packs/club-rooms";
import { seasonMomentsScenes } from "./cutscene-packs/season-moments";
import { prematchScenes } from "./cutscene-packs/prematch";
import { journeyScenes } from "./cutscene-packs/journey";
import { storyArcScenes } from "./cutscene-packs/story-arc";
import { teamRoutineScenes } from "./cutscene-packs/team-routine";
import { choicesScenes } from "./cutscene-packs/choices";

export const CUTSCENES: Record<string, Cutscene> = {
  ...historyScenes,
  ...trainingScenes,
  ...clubRoomsScenes,
  ...seasonMomentsScenes,
  ...prematchScenes,
  ...journeyScenes,
  ...storyArcScenes,
  ...teamRoutineScenes,
  ...choicesScenes,
};

/** Sequência imersiva antes do apito inicial. */
export const PREMATCH_SCENE_IDS = [
  "prematch-locker",
  "prematch-kit",
  "prematch-tunnel",
  "prematch-whistle",
] as const;

/** Continuidade cinematográfica entre o apito final e o relatório. */
export const POSTMATCH_SCENE_IDS = [
  "postmatch-tunnel",
  "postmatch-locker",
  "postmatch-press",
] as const;

/** Cenas de treino sorteadas semana a semana no modo carreira. */
export const TRAINING_SCENE_IDS = [
  "training-warmup",
  "training-tactics",
  "training-finishing",
  "training-gym",
  "training-talk",
  "staffroom",
] as const;

/** Cenas de momento sorteadas ao longo da temporada. */
export const MOMENT_SCENE_IDS = [
  "bus-arrival",
  "warmup-pitch",
  "team-talk",
  "coin-toss",
  "anthem",
  "crowd-entry",
  "goal-roar",
  "penalty-decisive",
  "red-card",
  "substitution",
  "halftime-fix",
  "press-after-win",
  "press-after-loss",
  "trophy-lift",
  "promotion-night",
  "relegation-night",
  "derby-week-buildup",
  "scout-report",
  "agent-offer",
  "board-review",
  "youth-debut-night",
  "medical-room",
  "fan-meeting",
  "contract-renewal",
  "season-farewell",
] as const;

/** Todas as cenas que a galeria pode listar. */
export const SCENE_LIST = Object.values(CUTSCENES);

/** Cenas do arco de história: crise, ultimato, demissão, reconstrução e lendas. */
export const STORY_SCENE_IDS = [
  "season-kickoff",
  "crisis-meeting",
  "ultimatum",
  "captain-split",
  "dressing-unity",
  "mind-games",
  "captain-injury",
  "academy-gem",
  "transfer-saga",
  "deadline-day",
  "cup-final-eve",
  "relegation-fight",
  "sacking-night",
  "job-interview",
  "rebuild-day-one",
  "legend-retirement",
  "unbeatable-run",
  "captain-100",
  "injury-crisis",
  "fan-fury",
  "board-pleased",
  "empty-seats",
] as const;

/** As 25 cenas híbridas: câmera 3D real (perspectiva, plano de chão, paralaxe). */
for (const id of MOMENT_SCENE_IDS) {
  const s = CUTSCENES[id];
  if (s) s.hybrid = true;
}

/** O arco de história também ganha perspectiva 3D (os cenários já existem). */
for (const id of STORY_SCENE_IDS) {
  const s = CUTSCENES[id];
  if (s) s.hybrid = true;
}

/** Cenas jogáveis: têm escolha com consequência na carreira. */
export const CHOICE_SCENE_IDS = [
  "agent-demands",
  "unhappy-knock",
  "derby-eve-talk",
  "doctor-gamble",
  "president-call",
] as const;

for (const id of CHOICE_SCENE_IDS) {
  const s = CUTSCENES[id];
  if (s) s.hybrid = true;
}
