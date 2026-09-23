/**
 * Ponte física visual de baixa complexidade para a bola.
 *
 * O Worker chama este módulo depois de `MatchSim.step`. Ele pode enriquecer a
 * imagem com quique, giro, trave e rede, mas nunca devolve dados para
 * `MatchSim`. Regras, placar, posse, saves e replays continuam canônicos.
 */
import RAPIER from "@dimforge/rapier3d-compat";

import {
  type CanonicalBallPhysicsState,
  type VisualBallState,
  visualBallFromCanonical,
} from "./visual-ball";

export const BALL_PHYSICS_RADIUS = 0.12;

const DEFAULT_FIELD_X = 52.5;
const DEFAULT_FIELD_Z = 34;
const GOAL_HALF_WIDTH = 3.66;
const GOAL_HEIGHT = 2.44;
const MAX_VISUAL_DIVERGENCE = 2.4;

export interface RapierVisualPhysicsOptions {
  fieldX?: number;
  fieldZ?: number;
}

export interface RapierVisualPhysics {
  readonly engine: "rapier-wasm-visual";
  reset(canonical: CanonicalBallPhysicsState): void;
  synchronize(before: CanonicalBallPhysicsState, after: CanonicalBallPhysicsState): void;
  step(dt: number): void;
  read(fallback: CanonicalBallPhysicsState): VisualBallState;
  dispose(): void;
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function copyState(state: CanonicalBallPhysicsState): CanonicalBallPhysicsState {
  return { ...state };
}

function distance3D(
  a: Pick<CanonicalBallPhysicsState, "x" | "z" | "height">,
  b: Pick<CanonicalBallPhysicsState, "x" | "z" | "height">,
) {
  return Math.hypot(a.x - b.x, a.z - b.z, a.height - b.height);
}

let rapierReady: Promise<void> | null = null;

function initializeRapier() {
  return (rapierReady ??= RAPIER.init());
}

function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // Uma bola e poucos colisores: custo estável no Worker, sem 22 corpos.
  world.numSolverIterations = 4;
  world.maxCcdSubsteps = 2;
  return world;
}

type RapierWorld = ReturnType<typeof makeWorld>;
type RapierBody = ReturnType<RapierWorld["createRigidBody"]>;
type RapierCollider = ReturnType<RapierWorld["createCollider"]>;

class RapierVisualBall implements RapierVisualPhysics {
  readonly engine = "rapier-wasm-visual" as const;

  private readonly world: RapierWorld;
  private readonly ballBody: RapierBody;
  private readonly ballCollider: RapierCollider;
  private attached = false;
  private disposed = false;
  private lastCanonical: CanonicalBallPhysicsState | null = null;
  private visualSpin = 0;
  private skipNextStep = false;

  constructor(private readonly options: Required<RapierVisualPhysicsOptions>) {
    this.world = makeWorld();
    this.createPitchAndGoalColliders();
    this.ballBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, BALL_PHYSICS_RADIUS, 0)
        .setCcdEnabled(true)
        .setCanSleep(false)
        .setLinearDamping(0.16)
        .setAngularDamping(0.28),
    );
    this.ballCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_PHYSICS_RADIUS).setFriction(0.72).setRestitution(0.54),
      this.ballBody,
    );
  }

  reset(canonical: CanonicalBallPhysicsState) {
    if (this.disposed) return;
    this.lastCanonical = copyState(canonical);
    this.visualSpin = canonical.spin;
    this.skipNextStep = false;
    this.setPose(canonical);
  }

  synchronize(before: CanonicalBallPhysicsState, after: CanonicalBallPhysicsState) {
    if (this.disposed) return;

    if (after.attached) {
      this.setPose(after);
      this.lastCanonical = copyState(after);
      this.visualSpin = after.spin;
      this.skipNextStep = false;
      return;
    }

    const released = before.attached && !after.attached;
    const holderChanged = before.holder !== after.holder;
    const discontinuity = released || holderChanged || this.hasRuleDiscontinuity(before, after);

    if (discontinuity) {
      // A regra já integrou este quadro. Recomeçar aqui evita uma segunda
      // integração visual do chute, bloqueio ou reinício no mesmo tick.
      this.setPose(after);
      this.skipNextStep = true;
    } else if (this.attached) {
      this.setDynamic(after);
    }

    this.attached = false;
    this.visualSpin = finite(after.spin, this.visualSpin);
    this.lastCanonical = copyState(after);
  }

  step(dt: number) {
    if (this.disposed || this.attached) return;
    if (this.skipNextStep) {
      this.skipNextStep = false;
      return;
    }

    const safeDt = Math.max(1 / 240, Math.min(1 / 15, finite(dt, 1 / 30)));
    const velocity = this.ballBody.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);
    if (Math.abs(this.visualSpin) > 0.001 && speed > 0.01) {
      const magnus = this.visualSpin * safeDt * 0.045;
      this.ballBody.setLinvel(
        {
          x: velocity.x - (velocity.z / speed) * magnus,
          y: velocity.y,
          z: velocity.z + (velocity.x / speed) * magnus,
        },
        true,
      );
      this.visualSpin *= Math.exp(-0.85 * safeDt);
    }

    // Um world.step por passo espacial do Worker mantém o custo previsível.
    this.world.timestep = safeDt;
    this.world.step();
  }

  read(fallback: CanonicalBallPhysicsState): VisualBallState {
    if (this.disposed || this.attached) return visualBallFromCanonical(fallback);

    const translation = this.ballBody.translation();
    const velocity = this.ballBody.linvel();
    const visual: VisualBallState = {
      x: finite(translation.x, fallback.x),
      z: finite(translation.z, fallback.z),
      height: Math.max(BALL_PHYSICS_RADIUS, finite(translation.y, fallback.height)),
      vx: finite(velocity.x, fallback.vx),
      vy: finite(velocity.y, fallback.vy),
      vz: finite(velocity.z, fallback.vz),
      spin: finite(this.visualSpin, fallback.spin),
    };

    const divergence = distance3D(visual, fallback);
    if (divergence <= MAX_VISUAL_DIVERGENCE) return visual;

    // Um rebote visual pode divergir por um instante; depois aproximamos a
    // apresentação da verdade canônica para que uma regra posterior nunca
    // pareça errada. A correção permanece só neste mundo visual.
    const blend = Math.min(0.72, (divergence - MAX_VISUAL_DIVERGENCE) / divergence);
    const corrected: VisualBallState = {
      x: visual.x + (fallback.x - visual.x) * blend,
      z: visual.z + (fallback.z - visual.z) * blend,
      height:
        visual.height + (Math.max(BALL_PHYSICS_RADIUS, fallback.height) - visual.height) * blend,
      vx: visual.vx + (fallback.vx - visual.vx) * blend,
      vy: visual.vy + (fallback.vy - visual.vy) * blend,
      vz: visual.vz + (fallback.vz - visual.vz) * blend,
      spin: visual.spin + (fallback.spin - visual.spin) * blend,
    };
    this.setDynamic({ ...fallback, ...corrected, attached: false, holder: null });
    return corrected;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.world.free();
    this.lastCanonical = null;
  }

  private hasRuleDiscontinuity(
    before: CanonicalBallPhysicsState,
    after: CanonicalBallPhysicsState,
  ) {
    if (!this.lastCanonical) return false;
    const velocityDelta = Math.hypot(
      after.vx - before.vx,
      after.vy - before.vy,
      after.vz - before.vz,
    );
    const heightDelta = Math.abs(after.height - before.height);
    // Lances livres em velocidade máxima podem avançar ~3m por passo; só
    // tratamos grandes saltos como teleporte de regra/reinício.
    const positionJump = distance3D(before, after);
    return velocityDelta > 18 || heightDelta > 1.75 || positionJump > 4.2;
  }

  private setPose(state: CanonicalBallPhysicsState) {
    this.attached = state.attached;
    this.visualSpin = finite(state.spin);
    if (state.attached) this.setAttached(state);
    else this.setDynamic(state);
  }

  private setAttached(state: CanonicalBallPhysicsState) {
    this.ballBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.ballCollider.setSensor(true);
    this.ballBody.setTranslation(
      {
        x: finite(state.x),
        y: Math.max(BALL_PHYSICS_RADIUS, finite(state.height)),
        z: finite(state.z),
      },
      true,
    );
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  private setDynamic(state: CanonicalBallPhysicsState) {
    this.attached = false;
    this.ballBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ballCollider.setSensor(false);
    this.ballBody.setTranslation(
      {
        x: finite(state.x),
        y: Math.max(BALL_PHYSICS_RADIUS, finite(state.height)),
        z: finite(state.z),
      },
      true,
    );
    this.ballBody.setLinvel(
      { x: finite(state.vx), y: finite(state.vy), z: finite(state.vz) },
      true,
    );
    this.ballBody.setAngvel({ x: 0, y: finite(state.spin), z: 0 }, true);
  }

  private createPitchAndGoalColliders() {
    const { fieldX, fieldZ } = this.options;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(fieldX + 2, BALL_PHYSICS_RADIUS, fieldZ + 2)
        .setTranslation(0, -BALL_PHYSICS_RADIUS, 0)
        .setFriction(0.84)
        .setRestitution(0.48),
    );

    for (const direction of [-1, 1]) {
      const goalX = direction * fieldX;
      for (const goalZ of [-GOAL_HALF_WIDTH, GOAL_HALF_WIDTH]) {
        this.world.createCollider(
          RAPIER.ColliderDesc.cylinder(GOAL_HEIGHT / 2, 0.075)
            .setTranslation(goalX, GOAL_HEIGHT / 2, goalZ)
            .setFriction(0.35)
            .setRestitution(0.7),
        );
      }
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.075, 0.075, GOAL_HALF_WIDTH)
          .setTranslation(goalX, GOAL_HEIGHT, 0)
          .setFriction(0.35)
          .setRestitution(0.68),
      );
      // Rede leve: dá retorno visual à finalização sem decidir se foi gol.
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, GOAL_HEIGHT / 2, GOAL_HALF_WIDTH)
          .setTranslation(direction * (fieldX + 0.95), GOAL_HEIGHT / 2, 0)
          .setFriction(0.72)
          .setRestitution(0.22),
      );
    }
  }
}

/**
 * Inicialização preguiçosa: este módulo só é importado pelo Worker em uma
 * partida ao vivo. Uma falha no WASM pode cair para a bola canônica sem
 * interromper a simulação da partida.
 */
export async function createRapierVisualPhysics(
  options: RapierVisualPhysicsOptions = {},
): Promise<RapierVisualPhysics> {
  await initializeRapier();
  return new RapierVisualBall({
    fieldX: options.fieldX ?? DEFAULT_FIELD_X,
    fieldZ: options.fieldZ ?? DEFAULT_FIELD_Z,
  });
}
