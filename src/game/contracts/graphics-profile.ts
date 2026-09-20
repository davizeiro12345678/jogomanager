export const GRAPHICS_PROFILE_VERSION = 1 as const;

export type GraphicsTier = "baixa" | "media" | "alta" | "cinema";

export interface GraphicsProfileContract {
  version: typeof GRAPHICS_PROFILE_VERSION;
  id: GraphicsTier;
  targetFps: number;
  targetP95FrameMs: number;
  maxPixelRatio: number;
  shadowMapSize: 512 | 1024 | 2048;
  textureMaxSize: 1024 | 2048 | 4096;
  crowdUpdateDivisor: 1 | 2 | 3 | 4;
  postProcessing: "off" | "balanced" | "cinema";
}

export const GRAPHICS_PROFILES: Record<GraphicsTier, GraphicsProfileContract> = {
  baixa: { version: 1, id: "baixa", targetFps: 60, targetP95FrameMs: 22, maxPixelRatio: 1, shadowMapSize: 512, textureMaxSize: 1024, crowdUpdateDivisor: 4, postProcessing: "off" },
  media: { version: 1, id: "media", targetFps: 60, targetP95FrameMs: 20, maxPixelRatio: 1.35, shadowMapSize: 1024, textureMaxSize: 2048, crowdUpdateDivisor: 2, postProcessing: "balanced" },
  alta: { version: 1, id: "alta", targetFps: 45, targetP95FrameMs: 28, maxPixelRatio: 1.7, shadowMapSize: 2048, textureMaxSize: 2048, crowdUpdateDivisor: 1, postProcessing: "balanced" },
  cinema: { version: 1, id: "cinema", targetFps: 30, targetP95FrameMs: 33.3, maxPixelRatio: 2, shadowMapSize: 2048, textureMaxSize: 4096, crowdUpdateDivisor: 1, postProcessing: "cinema" },
};
