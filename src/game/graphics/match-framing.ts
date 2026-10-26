import { standCameraPosition } from "@/game/stand-camera";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { type SimPlayer } from "@/game/sim-types";

export type ShotId =
  | "wide"
  | "drone"
  | "skycam"
  | "lowline"
  | "sideline"
  | "duel"
  | "playercam"
  | "tower"
  | "netcam"
  | "stand"
  | "crane"
  | "celebration"
  | "orbit";

export type Framing = {
  px: number;
  py: number;
  pz: number;
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

/** Preserve horizontal coverage when the match surface becomes a portrait. */
export function framingFov(verticalFov: number, aspect: number, wholePitch = false): number {
  const referenceAspect = wholePitch ? 1.85 : 1.4;
  const ratio = Number.isFinite(aspect) ? Math.max(0.25, aspect) : referenceAspect;
  return ratio < referenceAspect
    ? (360 / Math.PI) *
        Math.atan((Math.tan((verticalFov * Math.PI) / 360) * referenceAspect) / ratio)
    : verticalFov;
}

/** Contexto simples do lance usado para escolher o plano. */
export type ShotContext = {
  bx: number;
  bz: number;
  speed: number;
  height: number;
  attackDir: number; // +1 ataca para +X
  pulse: number;
  nearGoal: number; // 0..1 proximidade da grande área
  holder: SimPlayer | null;
  heading: number;
  focusX: number | null;
  focusZ: number | null;
};

export function framingFor(id: ShotId, c: ShotContext, t: number): Framing {
  const { bx, bz, attackDir, holder, heading } = c;
  switch (id) {
    case "skycam": {
      const sweep = Math.sin(t * 0.21) * 7;
      return {
        px: bx * 0.56 - attackDir * 10,
        py: 64 + Math.sin(t * 0.34) * 2.4,
        pz: bz * 0.34 + sweep,
        lx: bx + attackDir * 4,
        ly: 0.7,
        lz: bz * 0.78,
        fov: 34,
      };
    }
    case "drone":
      return {
        px: bx - attackDir * 26,
        py: 20 + c.height * 0.4,
        pz: bz * 0.6 + 16,
        lx: bx + attackDir * 6,
        ly: 1 + Math.min(3, c.height * 0.5),
        lz: bz * 0.7,
        fov: 46,
      };
    case "crane": {
      const arc = t * 0.18;
      return {
        px: bx - attackDir * 12 + Math.sin(arc) * 4.2,
        py: 11.5 + Math.cos(arc * 1.3) * 1.4,
        pz: bz * 0.5 + 13 + Math.cos(arc) * 2.4,
        lx: bx + attackDir * 2.8,
        ly: 1.05 + Math.min(1.8, c.height * 0.35),
        lz: bz * 0.76,
        fov: 37,
      };
    }
    case "sideline": {
      const side = bz >= 0 ? 1 : -1;
      return {
        px: bx * 0.88 - attackDir * 2.5,
        py: 3.65,
        pz: side * (FIELD_Z + 7.5),
        lx: bx + attackDir * 3.6,
        ly: 1.15 + Math.min(1.4, c.height * 0.34),
        lz: bz,
        fov: 39,
      };
    }
    case "lowline":
      return {
        px: bx * 0.7,
        py: 3.2,
        pz: FIELD_Z + 9,
        lx: bx,
        ly: 1.2 + c.height * 0.4,
        lz: bz,
        fov: 40,
      };
    case "duel":
      return {
        px: bx - attackDir * 9,
        py: 4.4,
        pz: bz + 11,
        lx: bx,
        ly: 1.5 + c.height * 0.5,
        lz: bz,
        fov: 34,
      };
    case "playercam": {
      const focusX = c.focusX ?? holder?.x ?? bx;
      const focusZ = c.focusZ ?? holder?.z ?? bz;
      const forwardX = Math.sin(heading);
      const forwardZ = Math.cos(heading);
      return {
        px: focusX - forwardX * 7.2 + forwardZ * 1.15,
        py: 2.45,
        pz: focusZ - forwardZ * 7.2 - forwardX * 1.15,
        lx: focusX + forwardX * 3.2,
        ly: 1.18 + Math.min(1.2, c.height * 0.3),
        lz: focusZ + forwardZ * 3.2,
        fov: 41,
      };
    }
    case "tower":
      return {
        px: 0,
        py: 88,
        pz: FIELD_Z + 8,
        lx: 0,
        ly: 0.8,
        lz: 0,
        fov: 44,
      };
    case "netcam":
      return {
        px: (FIELD_X + 6) * attackDir,
        py: 6.5,
        pz: bz * 0.35,
        lx: bx,
        ly: 1.4 + c.height * 0.6,
        lz: bz,
        fov: 38,
      };
    case "stand": {
      const side = bz >= 0 ? 1 : -1;
      const eye = standCameraPosition(FIELD_Z, side);
      return {
        px: bx * 0.58,
        py: eye.y,
        pz: eye.z,
        lx: bx * 0.72,
        ly: 1,
        lz: bz * 0.78,
        fov: 40,
      };
    }
    case "celebration":
      return {
        px: bx + Math.cos(t * 0.5) * 11,
        py: 3.6,
        pz: bz + Math.sin(t * 0.5) * 11,
        lx: bx,
        ly: 1.7,
        lz: bz,
        fov: 33,
      };
    case "orbit": {
      const a = t * 0.35;
      return {
        px: bx + Math.cos(a) * 17,
        py: 7.5,
        pz: bz + Math.sin(a) * 17,
        lx: bx,
        ly: 1.2,
        lz: bz,
        fov: 36,
      };
    }
    case "wide":
    default:
      return {
        px: bx * 0.55,
        // A broadcast lens keeps enough width to read the next passing lane
        // while giving bodies and ball contacts more pixels than the tower.
        py: 29 + Math.min(4, c.speed * 0.16),
        pz: FIELD_Z + 27 + Math.min(5, c.speed * 0.18),
        lx: bx * 0.6,
        ly: 0.9 + Math.min(2.4, c.height * 0.5),
        lz: bz * 0.6,
        fov: 42,
      };
  }
}
