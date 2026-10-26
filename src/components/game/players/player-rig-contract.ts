/** Shared rig presentation contract. No Three/WebGL code is loaded here. */
import type React from "react";
import type { SimPlayer, SimView } from "@/game/sim";
import type { Kit } from "@/game/kits";
import type { GoalFocusRef } from "@/game/goal-choreography";
import type { PlayerLook } from "@/game/player-model";
import type { ClipName } from "@/game/animation";
import type { RigSkin } from "@/game/rig-skin";

/**
 * Velocidade (m/s) para a qual cada ciclo de passada foi desenhado. A cadência
 * do clipe é reescalada pela velocidade real do atleta, de modo que o pé de
 * apoio acompanhe o deslocamento no gramado em vez de patinar.
 */
export const GAIT_SPEED: Record<string, number> = {
  walk: 1.6,
  stroll: 1.3,
  walkTalk: 1.5,
  tired: 1.5,
  exhaustedWalk: 1.2,
  limp: 1.1,
  skipStep: 2.2,
  jog: 3.4,
  joggingBack: 3.0,
  runRelaxed: 4.6,
  checkShoulder: 4.4,
  run: 5.5,
  curveRunLeft: 5.8,
  curveRunRight: 5.8,
  sprint: 7.6,
  sprintFlatOut: 8.2,
  sprintEasing: 6.6,
  recoverySprint: 8.0,
};

export type Quality = "alta" | "media" | "baixa";

/* -------------------------------------------------------------------------- */

export interface RenderedPlayerAppearance {
  hairStyle: PlayerLook["hairStyle"];
  revision: string;
  root: string;
  meshes: number;
  vertices: number;
  top: number;
  bridge?: string;
}

export interface RigProps {
  player: SimPlayer;
  sim: SimView;
  kit: Kit;
  goalPulse: React.MutableRefObject<number>;
  goalFocus?: GoalFocusRef | undefined;
  quality: Quality;
  paused?: boolean;
  respectVisualSettings?: boolean;
  /** Optional studio sampling; ordinary match playback always uses its clock. */
  previewAt?: number | undefined;
  /** Studio-only presentation override; never changes the simulation/save. */
  lookOverride?: PlayerLook | undefined;
  previewClip?: ClipName | undefined;
  previewRevision?: string | undefined;
  /** Dense face topology is reserved for the isolated portrait preview. */
  portrait?: boolean;
  /** Match-only topology LOD; materials and animation retain the selected quality. */
  denseGeometry?: boolean;
  /** Stable match topology avoids rebuilding meshes on a broadcast camera cut. */
  matchTopology?: boolean;
  clothPhysics?: boolean;
  /** Inspection cameras follow actual posed bones, never simulation positions. */
  onPoseReady?: ((skin: RigSkin) => void) | undefined;
  onAppearanceReady?: ((appearance: RenderedPlayerAppearance) => void) | undefined;
}
