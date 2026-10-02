export const ACCESSIBILITY_STORAGE_KEY = "manager3d.accessibility.v1";
export interface AccessibilityPreferences {
  textSize: "normal" | "large" | "xlarge";
  contrast: "standard" | "high";
  motion: "system" | "reduced" | "full";
  readingSpace: boolean;
  narration: "off" | "voice" | "captions";
  captions: boolean;
  volume: number;
  rate: number;
  realistic: boolean;
  voiceURI: string;
}
export const DEFAULT_ACCESSIBILITY: Readonly<AccessibilityPreferences> = {
  textSize: "normal",
  contrast: "standard",
  motion: "system",
  readingSpace: false,
  narration: "off",
  captions: true,
  volume: 0.85,
  rate: 1.05,
  realistic: true,
  voiceURI: "",
};
export function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
/** Browser storage is untrusted. Old/partial preferences never break a game. */
export function parseAccessibility(raw: unknown): AccessibilityPreferences {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    textSize: p["textSize"] === "large" || p["textSize"] === "xlarge" ? p["textSize"] : "normal",
    contrast: p["contrast"] === "high" ? "high" : "standard",
    motion: p["motion"] === "reduced" || p["motion"] === "full" ? p["motion"] : "system",
    readingSpace: p["readingSpace"] === true,
    narration: p["narration"] === "voice" || p["narration"] === "captions" ? p["narration"] : "off",
    captions: p["captions"] !== false,
    volume: boundedNumber(p["volume"], 0.85, 0, 1),
    rate: boundedNumber(p["rate"], 1.05, 0.7, 1.5),
    realistic: p["realistic"] !== false,
    voiceURI: typeof p["voiceURI"] === "string" ? p["voiceURI"].slice(0, 256) : "",
  };
}
