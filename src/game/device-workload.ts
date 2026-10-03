/** Leave cores for rendering and the match simulation while decoding GPU textures. */
export function textureDecodeWorkers(cores: number | undefined, memoryGb: number | undefined): number {
  const available = Number.isFinite(cores) ? Math.max(1, Math.floor(cores ?? 2)) : 2;
  if (available <= 4 || (memoryGb !== undefined && memoryGb <= 3)) return 1;
  return Math.min(4, available - 2);
}

export function deviceTextureDecodeWorkers(): number {
  if (typeof navigator === "undefined") return 1;
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return textureDecodeWorkers(navigator.hardwareConcurrency, memoryGb);
}