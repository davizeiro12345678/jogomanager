import { censusRef } from "@/game/scene-census";

import { footballTextures } from "@/components/game/stadium/textures/ball";
import { BallResponse } from "@/game/ball-response";
import { BallRoll } from "@/game/ball-roll";
import { BallTrail } from "@/game/ball-trail";

import { useFrame } from "@react-three/fiber";

import { Trail } from "@react-three/drei";

import { useMemo, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { ktx2, useKtx2Revision } from "@/game/textures/ktx2";

import { type SimView } from "@/game/sim-types";

import { presentationBall, type Quality } from "./shared";
export function Ball({
  sim,
  quality,
  hiVis = false,
  wet = 0,
}: {
  sim: SimView;
  quality: Quality;
  hiVis?: boolean;
  wet?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const puff = useRef<THREE.Mesh>(null);
  const trail = useRef<ComponentRef<typeof Trail>>(null);
  const prevH = useRef(0.12);
  const spray = useRef(0);
  const textures = useMemo(footballTextures, []);
  useKtx2Revision();
  const normal = quality !== "baixa" ? ktx2("ball_normal") : null;
  const rough = quality !== "baixa" ? ktx2("ball_rough") : null;
  const response = useMemo(() => new BallResponse(), []);
  const rolling = useMemo(() => new BallRoll(), []);
  const trailFade = useMemo(() => new BallTrail(), []);
  const previous = useRef<{
    x: number;
    z: number;
    height: number;
    vx: number;
    vz: number;
    vy: number;
  } | null>(null);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const squashAxis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const orientation = useMemo(() => new THREE.Quaternion(), []);
  const worldScale = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const visualBall = presentationBall(sim);
    const delta = Math.min(Math.max(0, dt), 0.05);
    const snap =
      !previous.current || Math.hypot(visualBall.x - m.position.x, visualBall.z - m.position.z) > 4;
    if (snap) response.reset();
    const blend = snap ? 1 : 1 - Math.exp(-42 * delta);
    const trailMesh = trail.current;
    if (trailMesh) {
      const opacity = trailFade.step(Math.hypot(visualBall.vx, visualBall.vz), delta, snap);
      trailMesh.visible = opacity > 0;
      const material = trailMesh.material as THREE.Material;
      material.transparent = true;
      material.depthWrite = false;
      material.opacity = opacity;
    }
    m.position.x += (visualBall.x - m.position.x) * blend;
    m.position.z += (visualBall.z - m.position.z) * blend;
    // The simulation exposes height of the centre, including the ball radius.
    m.position.y = Math.max(0.12, visualBall.height);
    const prior = previous.current;
    const verticalVelocity =
      sim.visualBall?.vy ?? (prior && delta > 0 ? (visualBall.height - prior.height) / delta : 0);
    if (prior && !snap) {
      const kick = Math.hypot(visualBall.vx - prior.vx, visualBall.vz - prior.vz);
      const bounce = prior.vy < -0.6 && verticalVelocity >= 0 && visualBall.height < 0.35;
      if (bounce) {
        response.impact(Math.abs(prior.vy));
        squashAxis.set(0, 1, 0);
      } else if (kick > 3.5) {
        response.impact(kick);
        squashAxis.set(visualBall.vx - prior.vx, 0, visualBall.vz - prior.vz).normalize();
      }
    }
    const roll = rolling.step(m.position.x, m.position.z, visualBall.height, delta, snap);
    if (roll.angle > 0) m.rotateOnWorldAxis(axis.set(roll.axisX, 0, roll.axisZ), roll.angle);
    if (visualBall.height > 0.2)
      m.rotateOnWorldAxis(axis.set(0, 1, 0), (sim.visualBall?.spin ?? 0) * delta);
    const scale = response.step(delta);
    // Convert the collision normal to mesh-local coordinates so spin does not
    // rotate the flattening plane away from the foot or the ground.
    orientation.copy(m.quaternion).invert();
    worldScale.copy(squashAxis).applyQuaternion(orientation);
    m.scale.set(
      scale.radial + (scale.axial - scale.radial) * worldScale.x ** 2,
      scale.radial + (scale.axial - scale.radial) * worldScale.y ** 2,
      scale.radial + (scale.axial - scale.radial) * worldScale.z ** 2,
    );
    if (!previous.current)
      previous.current = {
        x: visualBall.x,
        z: visualBall.z,
        height: visualBall.height,
        vx: visualBall.vx,
        vz: visualBall.vz,
        vy: verticalVelocity,
      };
    else Object.assign(previous.current, visualBall, { vy: verticalVelocity });
    const s = shadow.current;
    if (s) {
      s.position.set(m.position.x, 0.015, m.position.z);
      const k = Math.max(0.35, 1 - visualBall.height * 0.25);
      s.scale.setScalar(k);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.36 * k;
    }
    // respingo: quicada no gramado molhado levanta água
    const p = puff.current;
    if (p) {
      if (wet > 0.5 && prevH.current > 0.35 && visualBall.height <= 0.16) spray.current = 1;
      prevH.current = visualBall.height;
      if (spray.current > 0) {
        spray.current = Math.max(0, spray.current - dt * 3);
        p.visible = true;
        p.position.set(m.position.x, 0.06, m.position.z);
        p.scale.setScalar(0.3 + (1 - spray.current) * 1.4);
        (p.material as THREE.MeshBasicMaterial).opacity = 0.4 * spray.current;
      } else if (p.visible) {
        p.visible = false;
      }
    }
  });
  const ball = (
    <mesh ref={ref} castShadow={quality === "alta"} position={[0, 0.13, 0]}>
      <sphereGeometry args={[0.12, quality === "alta" ? 40 : 24, quality === "alta" ? 32 : 16]} />
      <meshStandardMaterial
        map={textures?.map ?? null}
        normalMap={normal}
        normalScale={[0.21, 0.21]}
        bumpMap={quality === "baixa" || normal ? null : (textures?.bumpMap ?? null)}
        bumpScale={0.0012}
        roughnessMap={rough ?? textures?.roughnessMap ?? null}
        // bola de alta visibilidade na neve; molhada reflete mais a luz
        color={hiVis ? "#f2ff45" : "#ffffff"}
        roughness={0.72 - wet * 0.23}
        metalness={0}
        envMapIntensity={0.65 + wet * 0.65}
      />
    </mesh>
  );
  return (
    <group ref={censusRef("ball")}>
      {/* rastro de velocidade (meshline) em chutes fortes — só média/alta */}
      {quality === "baixa" ? (
        ball
      ) : (
        <Trail ref={trail} width={0.55} length={5.5} color="#dff2ff" attenuation={(t) => t * t}>
          {ball}
        </Trail>
      )}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.36} />
      </mesh>
      <mesh ref={puff} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.12, 0.3, 20]} />
        <meshBasicMaterial color="#cfe6ff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ câmera */

/**
 * Diretor de câmera.
 *
 * Em vez de um único enquadramento seguindo a bola (que treme e cansa), a cena
 * tem um repertório de planos de transmissão. O diretor escolhe o plano pelo
 * contexto do lance, respeita um tempo mínimo em cada corte e evita repetir o
 * mesmo enquadramento em sequência. O amortecimento é por tempo real, com zona
 * morta ao redor da bola, o que elimina o tremor de alta frequência.
 */
