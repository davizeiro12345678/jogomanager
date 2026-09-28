/**
 * Autoridade física canônica da bola.
 *
 * Regras de futebol (posse, faltas, gols, replay e IA) continuam no MatchSim,
 * mas posição, velocidade, gravidade, contato com gramado, traves e rede são
 * calculados pelo mundo WASM do Rapier e escritos de volta nesse estado.
 */
import RAPIER from "@dimforge/rapier3d-compat";

import { pitchCondition } from "./ball-climate";
import type { WeatherKind } from "./sim-rules";

export const BALL_PHYSICS_RADIUS = 0.12;

const DEFAULT_FIELD_X = 52.5;
const DEFAULT_FIELD_Z = 34;
const GOAL_HALF_WIDTH = 3.66;
const GOAL_HEIGHT = 2.44;
// O MatchSim resolve finalizações no mesmo plano para evitar que um impacto
// em poste/travessão seja decidido como gol antes da colisão física.
const GOAL_LINE_INSET = 1.6;
const MAX_AUTHORITATIVE_STEP = 0.4;
const TARGET_SUBSTEP = 1 / 30;

export interface RapierBallState {
  x: number;
  z: number;
  height: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  holder: string | null;
}

export interface RapierBallHolder {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface RapierBallAuthorityOptions {
  fieldX?: number;
  fieldZ?: number;
}

/** Interface consumida pelo MatchSim sem acoplar a simulação às bindings WASM. */
export interface BallPhysicsAuthority {
  readonly engine: "rapier-wasm";
  reset(state: RapierBallState, holder?: RapierBallHolder | null): void;
  step(dt: number, state: RapierBallState, holder: RapierBallHolder | null): void;
  /**
   * Clima físico: atrito/restituição do gramado e vento (aceleração u/s²
   * aplicada só com a bola no ar). Opcional para implementações de teste.
   */
  setCondition?: ((weather: WeatherKind, wind: { x: number; z: number }) => void) | undefined;
  dispose(): void;
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function copyState(state: RapierBallState): RapierBallState {
  return { ...state };
}

let rapierReady: Promise<void> | null = null;

function initializeRapier() {
  return (rapierReady ??= RAPIER.init());
}

function changed(a: RapierBallState | null, b: RapierBallState) {
  if (!a) return true;
  return (
    a.holder !== b.holder ||
    Math.abs(a.x - b.x) > 0.0005 ||
    Math.abs(a.z - b.z) > 0.0005 ||
    Math.abs(a.height - b.height) > 0.0005 ||
    Math.abs(a.vx - b.vx) > 0.003 ||
    Math.abs(a.vy - b.vy) > 0.003 ||
    Math.abs(a.vz - b.vz) > 0.003 ||
    Math.abs(a.spin - b.spin) > 0.003
  );
}

function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  // Uma bola mais os colisores do estádio, com custo constante por passo.
  world.numSolverIterations = 4;
  world.maxCcdSubsteps = 2;
  return world;
}

type RapierWorld = ReturnType<typeof makeWorld>;
type RapierBody = ReturnType<RapierWorld["createRigidBody"]>;
type RapierCollider = ReturnType<RapierWorld["createCollider"]>;

/**
 * Mundo de física real da bola. A construção é privada ao factory assíncrono
 * porque o carregamento de WASM do Rapier precisa terminar antes de criar o
 * primeiro World.
 */
export class RapierBallAuthority implements BallPhysicsAuthority {
  readonly engine = "rapier-wasm" as const;

  private readonly world: RapierWorld;
  private readonly ballBody: RapierBody;
  private readonly ballCollider: RapierCollider;
  private pitchCollider: RapierCollider | null = null;
  private wind = { x: 0, z: 0 };
  private attached = false;
  private disposed = false;
  private lastWritten: RapierBallState | null = null;

  constructor(private readonly options: Required<RapierBallAuthorityOptions>) {
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
      RAPIER.ColliderDesc.ball(BALL_PHYSICS_RADIUS)
        .setFriction(0.72)
        .setRestitution(0.54),
      this.ballBody,
    );
  }

  reset(state: RapierBallState, holder: RapierBallHolder | null = null) {
    if (this.disposed) return;
    if (holder && holder.id === state.holder) this.setHeldState(state, holder);
    else this.setDynamicState(state);
    this.lastWritten = copyState(state);
  }

  setCondition(weather: WeatherKind, wind: { x: number; z: number }) {
    if (this.disposed) return;
    this.wind = { x: finite(wind.x), z: finite(wind.z) };
    const cond = pitchCondition(weather);
    this.pitchCollider?.setFriction(cond.rapierFriction);
    this.pitchCollider?.setRestitution(cond.rapierRestitution);
    this.ballCollider.setRestitution(cond.rapierBallRestitution);
  }

  step(dt: number, state: RapierBallState, holder: RapierBallHolder | null) {
    if (this.disposed) return;

    if (holder && holder.id === state.holder) {
      this.setHeldState(state, holder);
      this.stepWorld(dt);
      this.writeHeldState(state, holder);
      this.lastWritten = copyState(state);
      return;
    }

    // Um chute, defesa, desvio ou reinício é uma decisão de regra. Ela injeta
    // uma nova condição inicial no corpo Rapier; a integração seguinte é do
    // Rapier, não de coordenadas manuais no MatchSim.
    if (this.attached || changed(this.lastWritten, state)) this.setDynamicState(state);

    this.applyMagnusImpulse(dt, state.spin);
    this.applyWindImpulse(dt);
    this.stepWorld(dt);
    this.writeDynamicState(state);
    this.lastWritten = copyState(state);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.lastWritten = null;
    this.world.free();
  }

  private stepWorld(dt: number) {
    const total = Math.max(1 / 240, Math.min(MAX_AUTHORITATIVE_STEP, finite(dt, 1 / 30)));
    const count = Math.max(1, Math.ceil(total / TARGET_SUBSTEP));
    const substep = total / count;
    for (let index = 0; index < count; index += 1) {
      this.world.timestep = substep;
      this.world.step();
    }
  }

  private applyMagnusImpulse(dt: number, spin: number) {
    const velocity = this.ballBody.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);
    if (Math.abs(spin) < 0.001 || speed < 0.01) return;

    // A curva entra como impulso externo no mundo Rapier. Gravidade, atrito,
    // colisões e o resultado da integração seguem exclusivamente no solver.
    const strength = Math.max(-0.16, Math.min(0.16, finite(spin) * finite(dt, 1 / 30) * 0.045));
    this.ballBody.applyImpulse(
      { x: -(velocity.z / speed) * strength, y: 0, z: (velocity.x / speed) * strength },
      true,
    );
  }

  private applyWindImpulse(dt: number) {
    if (this.wind.x === 0 && this.wind.z === 0) return;
    const translation = this.ballBody.translation();
    if (translation.y < BALL_PHYSICS_RADIUS * 2.5) return; // no chão o vento não pega
    const step = finite(dt, 1 / 30);
    const clamp = (v: number) => Math.max(-0.16, Math.min(0.16, v));
    this.ballBody.applyImpulse(
      { x: clamp(this.wind.x * step * 0.045), y: 0, z: clamp(this.wind.z * step * 0.045) },
      true,
    );
  }

  private setHeldState(state: RapierBallState, holder: RapierBallHolder) {
    const target = this.holderTarget(holder);
    this.attached = true;
    this.ballBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.ballCollider.setSensor(true);
    this.ballBody.setTranslation(target, true);
    this.ballBody.setNextKinematicTranslation(target);
    this.ballBody.setLinvel({ x: finite(holder.vx), y: 0, z: finite(holder.vz) }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  private writeHeldState(state: RapierBallState, holder: RapierBallHolder) {
    const target = this.holderTarget(holder);
    state.x = target.x;
    state.z = target.z;
    state.height = BALL_PHYSICS_RADIUS;
    state.vx = finite(holder.vx);
    state.vy = 0;
    state.vz = finite(holder.vz);
    state.spin = 0;
  }

  private holderTarget(holder: RapierBallHolder) {
    const speed = Math.hypot(holder.vx, holder.vz);
    const directionX = speed > 0.01 ? holder.vx / speed : 1;
    const directionZ = speed > 0.01 ? holder.vz / speed : 0;
    return {
      x: finite(holder.x) + directionX * 0.9,
      y: BALL_PHYSICS_RADIUS,
      z: finite(holder.z) + directionZ * 0.9,
    };
  }

  private setDynamicState(state: RapierBallState) {
    this.attached = false;
    this.ballBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ballCollider.setSensor(false);
    this.ballBody.setTranslation(
      {
        x: finite(state.x),
        y: Math.max(BALL_PHYSICS_RADIUS, finite(state.height, BALL_PHYSICS_RADIUS)),
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

  private writeDynamicState(state: RapierBallState) {
    const translation = this.ballBody.translation();
    const velocity = this.ballBody.linvel();
    const angular = this.ballBody.angvel();
    state.x = finite(translation.x, state.x);
    state.z = finite(translation.z, state.z);
    state.height = Math.max(BALL_PHYSICS_RADIUS, finite(translation.y, state.height));
    state.vx = finite(velocity.x, state.vx);
    state.vy = finite(velocity.y, state.vy);
    state.vz = finite(velocity.z, state.vz);
    state.spin = finite(angular.y, state.spin);
  }

  private createPitchAndGoalColliders() {
    const { fieldX, fieldZ } = this.options;
    this.pitchCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(fieldX + 2, BALL_PHYSICS_RADIUS, fieldZ + 2)
        .setTranslation(0, -BALL_PHYSICS_RADIUS, 0)
        .setFriction(0.84)
        .setRestitution(0.48),
    );

    for (const direction of [-1, 1]) {
      const goalX = direction * (fieldX - GOAL_LINE_INSET);
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
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, GOAL_HEIGHT / 2, GOAL_HALF_WIDTH)
          .setTranslation(direction * (fieldX - GOAL_LINE_INSET + 0.95), GOAL_HEIGHT / 2, 0)
          .setFriction(0.72)
          .setRestitution(0.22),
      );
    }
  }
}

/** Inicializa WASM antes de construir o mundo canônico do Rapier. */
export async function createRapierBallAuthority(
  options: RapierBallAuthorityOptions = {},
): Promise<RapierBallAuthority> {
  await initializeRapier();
  return new RapierBallAuthority({
    fieldX: options.fieldX ?? DEFAULT_FIELD_X,
    fieldZ: options.fieldZ ?? DEFAULT_FIELD_Z,
  });
}
