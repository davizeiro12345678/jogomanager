import {
  devicePresentationWorkerBudget,
  presentationWorkerBudget,
} from "./presentation-worker-budget";

/** Keep KTX2 within the global presentation worker budget. */
export function textureDecodeWorkers(
  cores: number | undefined,
  memoryGb: number | undefined,
): number {
  return presentationWorkerBudget(cores, memoryGb).textures;
}

/** Legacy name for the single bounded background geometry lane. */
export function presentationWorkerCount(cores: number | undefined): number {
  return presentationWorkerBudget(cores, undefined).geometry;
}

export function deviceTextureDecodeWorkers(): number {
  return devicePresentationWorkerBudget().textures;
}
