import { makeLookRng } from "./player-model";

export interface FaceMorphology {
  jaw: number;
  cheek: number;
  temple: number;
  noseWidth: number;
  noseProjection: number;
  eyeSpacing: number;
  eyeWidth: number;
  eyeOpening: number;
  mouthWidth: number;
  lipVolume: number;
  hairline: number;
  parting: number;
  /** Small deterministic offsets keep procedural faces from reading as mirrored copies. */
  eyeAsymmetry: number;
  browAsymmetry: number;
  noseDeviation: number;
  cheekAsymmetry: number;
  mouthTilt: number;
}

const faces = new Map<number, Readonly<FaceMorphology>>();

/** Keep the athlete's tone identity while avoiding overly yellow albedo
 * under the daylight/ACES pipeline. This only changes rendered skin. */
export function skinAlbedo(color: string): string {
  const hex = color.replace("#", "");
  const rgb = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const corrected = [rgb[0]! * 0.96, rgb[1]! * 0.94, rgb[2]! * 0.91 + 20];
  return (
    "#" +
    corrected
      .map((value) =>
        Math.min(255, Math.max(0, Math.round(value)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** A separate random stream preserves the saved athlete's skin, physique,
 * haircut and accessories when additional facial landmarks are introduced. */
export function faceMorphology(seed: number): Readonly<FaceMorphology> {
  const existing = faces.get(seed);
  if (existing) return existing;
  const rng = makeLookRng(seed ^ 0x6a09e667);
  const range = (lo: number, hi: number) => lo + (hi - lo) * rng();
  const face = Object.freeze({
    jaw: range(0.94, 1.09),
    cheek: range(0.96, 1.055),
    temple: range(0.97, 1.035),
    noseWidth: range(0.105, 0.145),
    noseProjection: range(0.14, 0.205),
    eyeSpacing: range(0.33, 0.38),
    eyeWidth: range(0.154, 0.178),
    eyeOpening: range(0.105, 0.13),
    mouthWidth: range(0.235, 0.285),
    lipVolume: range(0.018, 0.029),
    hairline: range(-0.015, 0.055),
    parting: range(-0.6, 0.6),
    // Appended samples preserve all existing seeded face and hair landmarks.
    eyeAsymmetry: range(-0.012, 0.012),
    browAsymmetry: range(-0.018, 0.018),
    noseDeviation: range(-0.012, 0.012),
    cheekAsymmetry: range(-0.045, 0.045),
    mouthTilt: range(-0.018, 0.018),
  });
  if (faces.size >= 256) faces.delete(faces.keys().next().value!);
  faces.set(seed, face);
  return face;
}
