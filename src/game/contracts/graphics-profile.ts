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
  maxDrawCalls: number;
  maxTriangles: number;
}

export const GRAPHICS_PROFILES: Record<GraphicsTier, GraphicsProfileContract> = {
  baixa: {
    version: 1,
    id: "baixa",
    targetFps: 60,
    targetP95FrameMs: 22,
    maxPixelRatio: 0.9,
    shadowMapSize: 512,
    textureMaxSize: 1024,
    crowdUpdateDivisor: 4,
    postProcessing: "off",
    maxDrawCalls: 90,
    maxTriangles: 180_000,
  },
  media: {
    version: 1,
    id: "media",
    targetFps: 60,
    targetP95FrameMs: 20,
    maxPixelRatio: 1.2,
    shadowMapSize: 1024,
    textureMaxSize: 2048,
    crowdUpdateDivisor: 3,
    postProcessing: "balanced",
    maxDrawCalls: 170,
    maxTriangles: 420_000,
  },
  alta: {
    version: 1,
    id: "alta",
    targetFps: 45,
    targetP95FrameMs: 28,
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    textureMaxSize: 2048,
    crowdUpdateDivisor: 2,
    postProcessing: "balanced",
    maxDrawCalls: 260,
    maxTriangles: 850_000,
  },
  cinema: {
    version: 1,
    id: "cinema",
    targetFps: 30,
    targetP95FrameMs: 33.3,
    maxPixelRatio: 1.75,
    shadowMapSize: 2048,
    textureMaxSize: 4096,
    crowdUpdateDivisor: 1,
    postProcessing: "cinema",
    maxDrawCalls: 340,
    maxTriangles: 1_200_000,
  },
};
