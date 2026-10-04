import * as THREE from "three";
import type { Proportions } from "./player-model";
import type { RigSkin } from "./rig-skin";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface ClothMotion {
  x: number;
  z: number;
  lift: number;
  effort: number;
  bend: number;
  /** Facing angle and torso roll feed secondary cloth inertia, in radians. */
  yaw?: number;
  roll?: number;
}

/** Cosmetic second-order mechanics: fixed substeps, bounded inertia, no changes
 * to the authoritative match, collisions, saved player identity or ball. */
export class ClothDynamics {
  readonly offset = new Float64Array(2);
  private readonly velocity = new Float64Array(2);
  private priorX = 0;
  private priorZ = 0;
  private priorLift = 0;
  private priorYaw = 0;
  private priorRoll = 0;
  private ready = false;
  time = 0;
  impact = 0;
  turnRate = 0;
  rollRate = 0;
  constructor(
    private readonly stiffness = 86,
    private readonly damping = 15,
  ) {}

  advance(dt: number, motion: ClothMotion) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(dt, 0.25);
    const x = Number.isFinite(motion.x) ? clamp(motion.x, -15, 15) : 0;
    const z = Number.isFinite(motion.z) ? clamp(motion.z, -15, 15) : 0;
    const lift = Number.isFinite(motion.lift) ? motion.lift : this.priorLift;
    const yaw = Number.isFinite(motion.yaw) ? motion.yaw! : this.priorYaw;
    const roll = Number.isFinite(motion.roll)
      ? clamp(motion.roll!, -Math.PI, Math.PI)
      : this.priorRoll;
    if (!this.ready) {
      this.priorX = x;
      this.priorZ = z;
      this.priorLift = lift;
      this.priorYaw = yaw;
      this.priorRoll = roll;
      this.ready = true;
    }
    const ax = clamp((x - this.priorX) / dt, -28, 28);
    const az = clamp((z - this.priorZ) / dt, -28, 28);
    const landing = lift <= 0.025 ? clamp((this.priorLift - lift) / dt, 0, 4) : 0;
    // Heading wraps at ±π. Use the shortest signed arc so a small turn across
    // that seam cannot kick the shirt as if the athlete spun all the way round.
    const yawDelta = Math.atan2(Math.sin(yaw - this.priorYaw), Math.cos(yaw - this.priorYaw));
    this.turnRate = clamp(yawDelta / dt, -8, 8);
    this.rollRate = clamp((roll - this.priorRoll) / dt, -10, 10);
    this.priorX = x;
    this.priorZ = z;
    this.priorLift = lift;
    this.priorYaw = yaw;
    this.priorRoll = roll;
    const targetX = clamp(
      -ax * 0.00065 -
        x * Math.abs(x) * 0.000045 -
        this.turnRate * 0.00085 -
        this.rollRate * 0.00025,
      -0.016,
      0.016,
    );
    const targetZ = clamp(
      -az * 0.0008 - z * Math.abs(z) * 0.00006 + this.turnRate * 0.0003 - this.rollRate * 0.0002,
      -0.018,
      0.018,
    );
    const steps = Math.ceil(elapsed * 120),
      h = elapsed / steps;
    for (let step = 0; step < steps; step++) {
      for (let axis = 0; axis < 2; axis++) {
        const target = axis === 0 ? targetX : targetZ;
        this.velocity[axis] =
          this.velocity[axis]! +
          (this.stiffness * (target - this.offset[axis]!) - this.damping * this.velocity[axis]!) *
            h;
        this.offset[axis] = clamp(this.offset[axis]! + this.velocity[axis]! * h, -0.021, 0.021);
      }
      this.impact += (landing * 0.1 - this.impact) * Math.min(1, h * 18);
      this.time += h;
    }
  }
}

type Garment = { kind: "shirt" | "shorts"; bindings: number[][] };

/** Five native morphs per garment, built once. Only five coefficients per draw
 * change each frame; there is no per-frame vertex loop or custom shader patch.
 * Inertial translation includes outward clearance along the radial normal. */
export class AthleteCloth {
  readonly dynamics = new ClothDynamics();
  private readonly garments = new Map<THREE.BufferGeometry, Garment>();
  constructor(skin: RigSkin, p: Proportions, enabled = true) {
    if (!enabled) return;
    const upperArms = [skin.bones.indexOf(skin.boneOf.armL), skin.bones.indexOf(skin.boneOf.armR)];
    const forearms = [skin.bones.indexOf(skin.boneOf.foreL), skin.bones.indexOf(skin.boneOf.foreR)];
    const leftFemur = skin.bones.indexOf(skin.boneOf.legL),
      rightFemur = skin.bones.indexOf(skin.boneOf.legR);
    for (const group of skin.groups) {
      const kind =
        group.materialKey === "shorts"
          ? "shorts"
          : group.materialKey === "jersey" || group.materialKey === "jerseyPlain"
            ? "shirt"
            : null;
      if (!kind) continue;
      const geometry = group.geometry,
        position = geometry.getAttribute("position"),
        uv = geometry.getAttribute("uv"),
        skinIndex = geometry.getAttribute("skinIndex"),
        skinWeight = geometry.getAttribute("skinWeight");
      const weights = new Float32Array(position.count);
      const normals: THREE.Float32BufferAttribute[] = [],
        deltas: THREE.Float32BufferAttribute[] = [];
      const centerY = p.hipY + p.hipH * 0.5;
      const height = p.spineLen + p.chestLen + p.hipH * 0.12;
      for (let i = 0; i < position.count; i++) {
        const owner = skinIndex.getX(i),
          y = position.getY(i);
        if (kind === "shorts") {
          weights[i] = 1 - THREE.MathUtils.smoothstep(y - p.hipY, -p.hipH * 0.67, p.hipH * 0.2);
        } else if (upperArms.includes(owner) || forearms.includes(owner)) {
          // Shoulder and cuff attachments stay fixed; the sleeve body can move.
          weights[i] = Math.sin(Math.PI * clamp(uv.getY(i), 0, 1)) ** 2 * 0.52;
        } else {
          const v = clamp((y - centerY + p.hipH * 0.12) / height, 0, 1);
          weights[i] =
            Math.sin(Math.PI * v) ** 1.5 * (1 - THREE.MathUtils.smoothstep(v, 0.68, 0.88));
        }
      }
      const baseNormals = geometry.getAttribute("normal");
      for (let target = 0; target < 5; target++) {
        const delta = new Float32Array(position.count * 3);
        for (let i = 0; i < position.count; i++) {
          const owner = skinIndex.getX(i);
          const arm = upperArms.includes(owner) || forearms.includes(owner);
          const openingSide =
            skinIndex.getY(i) === leftFemur && skinIndex.getZ(i) === rightFemur
              ? skinWeight.getY(i) >= skinWeight.getZ(i)
                ? 1
                : -1
              : Math.sign(position.getX(i));
          const center =
            kind === "shirt" && arm
              ? Math.sign(position.getX(i)) * p.shoulderW * 0.52
              : kind === "shorts" && position.getY(i) < p.hipY - p.hipH * 0.6
                ? openingSide * p.hipW * 0.36
                : 0;
          const x = position.getX(i) - center,
            z = position.getZ(i),
            r = Math.max(0.01, Math.hypot(x, z));
          const nx = x / r,
            nz = z / r,
            w = weights[i]!;
          if (target < 4) {
            const axis = target < 2 ? 0 : 2,
              sign = target % 2 === 0 ? 1 : -1;
            const radial = target < 2 ? Math.abs(nx) : Math.abs(nz);
            const excursion = (kind === "shirt" ? 0.008 : 0.006) * w;
            delta[i * 3] = nx * radial * excursion;
            delta[i * 3 + 2] = nz * radial * excursion;
            delta[i * 3 + axis] = delta[i * 3 + axis]! + sign * excursion;
          } else {
            const fold =
              (0.35 + 0.65 * Math.sin(uv.getY(i) * Math.PI * 3 + uv.getX(i) * Math.PI * 4) ** 2) *
              w;
            delta[i * 3] = nx * fold * 0.003;
            delta[i * 3 + 2] = nz * fold * 0.003;
            delta[i * 3 + 1] = fold * 0.0008;
          }
        }
        // Relative normals are derived from the actual deformed garment.
        const deformed = geometry.clone(),
          deformedPosition = deformed.getAttribute("position");
        for (let i = 0; i < position.count; i++)
          deformedPosition.setXYZ(
            i,
            position.getX(i) + delta[i * 3]!,
            position.getY(i) + delta[i * 3 + 1]!,
            position.getZ(i) + delta[i * 3 + 2]!,
          );
        deformed.computeVertexNormals();
        const normalDelta = new Float32Array(position.count * 3),
          targetNormal = deformed.getAttribute("normal");
        for (let i = 0; i < position.count; i++)
          for (let c = 0; c < 3; c++)
            normalDelta[i * 3 + c] =
              targetNormal.getComponent(i, c) - baseNormals.getComponent(i, c);
        deformed.dispose();
        deltas.push(new THREE.Float32BufferAttribute(delta, 3));
        normals.push(new THREE.Float32BufferAttribute(normalDelta, 3));
      }
      geometry.morphTargetsRelative = true;
      geometry.morphAttributes.position = deltas;
      geometry.morphAttributes.normal = normals;
      this.garments.set(geometry, { kind, bindings: [] });
    }
  }

  bind(mesh: THREE.SkinnedMesh) {
    const garment = this.garments.get(mesh.geometry);
    if (garment && mesh.morphTargetInfluences) garment.bindings.push(mesh.morphTargetInfluences);
  }

  update(dt: number, motion: ClothMotion) {
    if (this.garments.size === 0) return;
    this.dynamics.advance(dt, motion);
    const x = this.dynamics.offset[0]! / 0.018,
      z = this.dynamics.offset[1]! / 0.018;
    const effort = Number.isFinite(motion.effort) ? clamp(motion.effort, 0, 1) : 0;
    const bend = Number.isFinite(motion.bend) ? clamp(Math.abs(motion.bend), 0, 1.5) : 0;
    const roll = Number.isFinite(motion.roll) ? Math.abs(motion.roll!) : 0;
    const angularLoad = clamp(Math.abs(this.dynamics.turnRate) / 5 + roll * 0.55, 0, 1);
    for (const garment of this.garments.values()) {
      const breath = 0.22 + Math.sin(this.dynamics.time * (1.9 + effort * 1.6)) * 0.09;
      const folds = clamp(breath + bend * 0.32 + this.dynamics.impact + angularLoad * 0.075, 0, 1);
      for (const weights of garment.bindings) {
        weights[0] = clamp(x, 0, 1);
        weights[1] = clamp(-x, 0, 1);
        weights[2] = clamp(z, 0, 1);
        weights[3] = clamp(-z, 0, 1);
        weights[4] =
          garment.kind === "shirt"
            ? folds
            : clamp(bend * 0.27 + this.dynamics.impact + angularLoad * 0.04, 0, 1);
      }
    }
  }
}
