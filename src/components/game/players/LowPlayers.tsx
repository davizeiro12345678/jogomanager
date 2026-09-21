import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Kit } from "@/game/kits";
import { lookFor, proportionsFor } from "@/game/player-model";
import type { SimView } from "@/game/sim";

type LowPlayersProps = {
  sim: SimView;
  homeKit: Kit;
  awayKit: Kit;
  homeGkKit: Kit;
  awayGkKit: Kit;
};

const BODY_PARTS = 22;
const LIMB_PARTS = BODY_PARTS * 2;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Corpo articulado de transmissão para aparelhos fracos.
 * Os 22 atletas compartilham oito desenhos instanciados, em vez de criarem
 * centenas de objetos individuais. A silhueta continua articulada em quadril,
 * ombros, cotovelos, joelhos e tornozelos.
 */
export function LowPlayers({ sim, homeKit, awayKit, homeGkKit, awayGkKit }: LowPlayersProps) {
  const torsoRef = useRef<THREE.InstancedMesh>(null);
  const hipsRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const hairRef = useRef<THREE.InstancedMesh>(null);
  const armsRef = useRef<THREE.InstancedMesh>(null);
  const thighsRef = useRef<THREE.InstancedMesh>(null);
  const shinsRef = useRef<THREE.InstancedMesh>(null);
  const bootsRef = useRef<THREE.InstancedMesh>(null);
  const neckRef = useRef<THREE.InstancedMesh>(null);
  const sleevesRef = useRef<THREE.InstancedMesh>(null);
  const shadowRef = useRef<THREE.InstancedMesh>(null);

  const phase = useRef(new Float32Array(BODY_PARTS));
  const yaw = useRef(new Float32Array(BODY_PARTS));
  const previousSpeed = useRef(new Float32Array(BODY_PARTS));
  const tmp = useMemo(() => ({
    root: new THREE.Matrix4(),
    joint: new THREE.Matrix4(),
    part: new THREE.Matrix4(),
    translate: new THREE.Matrix4(),
    rotate: new THREE.Matrix4(),
    scale: new THREE.Matrix4(),
    thighEnd: new THREE.Matrix4(),
    shinEnd: new THREE.Matrix4(),
    position: new THREE.Vector3(),
    shadowScale: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    euler: new THREE.Euler(),
    unit: new THREE.Vector3(1, 1, 1),
  }), []);

  const looks = useMemo(
    () => sim.players.map((player) => lookFor(player.id, player.pos, player.number === 10)),
    [sim.players],
  );
  const proportions = useMemo(() => looks.map(proportionsFor), [looks]);

  useEffect(() => {
    sim.players.forEach((player, index) => {
      const kit = player.pos === "GK"
        ? player.side === "home" ? homeGkKit : awayGkKit
        : player.side === "home" ? homeKit : awayKit;
      const look = looks[index];
      if (!look) return;
      torsoRef.current?.setColorAt(index, new THREE.Color(kit.base));
      hipsRef.current?.setColorAt(index, new THREE.Color(kit.shorts));
      headRef.current?.setColorAt(index, new THREE.Color(look.skin));
      neckRef.current?.setColorAt(index, new THREE.Color(look.skin));
      hairRef.current?.setColorAt(index, new THREE.Color(look.hairColor));
      bootsRef.current?.setColorAt(index * 2, new THREE.Color(look.bootColor));
      bootsRef.current?.setColorAt(index * 2 + 1, new THREE.Color(look.bootColor));
      for (const offset of [0, 1]) {
        const limbIndex = index * 2 + offset;
        armsRef.current?.setColorAt(limbIndex, new THREE.Color(look.skin));
        sleevesRef.current?.setColorAt(limbIndex, new THREE.Color(kit.pattern === "sleeves" ? kit.detail : kit.base));
        thighsRef.current?.setColorAt(limbIndex, new THREE.Color(kit.shorts));
        shinsRef.current?.setColorAt(limbIndex, new THREE.Color(kit.socks));
      }
    });
    for (const mesh of [torsoRef.current, hipsRef.current, headRef.current, hairRef.current, armsRef.current, sleevesRef.current, thighsRef.current, shinsRef.current, bootsRef.current, neckRef.current, shadowRef.current]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (mesh) mesh.frustumCulled = false;
    }
  }, [awayGkKit, awayKit, homeGkKit, homeKit, looks, sim.players]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const meshes = [torsoRef.current, hipsRef.current, headRef.current, hairRef.current, armsRef.current, sleevesRef.current, thighsRef.current, shinsRef.current, bootsRef.current, neckRef.current, shadowRef.current];
    if (meshes.some((mesh) => !mesh)) return;

    const { root, joint, part, translate, rotate, scale, thighEnd, shinEnd, position, shadowScale, quaternion, euler, unit } = tmp;
    const setPart = (
      mesh: THREE.InstancedMesh,
      index: number,
      parent: THREE.Matrix4,
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      pitch: number,
      roll: number,
      sizeX: number,
      sizeY: number,
      sizeZ: number,
      end?: THREE.Matrix4,
    ) => {
      translate.makeTranslation(offsetX, offsetY, offsetZ);
      joint.multiplyMatrices(parent, translate);
      quaternion.setFromEuler(euler.set(pitch, 0, roll));
      rotate.makeRotationFromQuaternion(quaternion);
      part.multiplyMatrices(joint, rotate);
      translate.makeTranslation(0, -sizeY * 0.5, 0);
      part.multiply(translate);
      scale.makeScale(sizeX, sizeY, sizeZ);
      part.multiply(scale);
      mesh.setMatrixAt(index, part);
      if (end) {
        end.multiplyMatrices(joint, rotate);
        translate.makeTranslation(0, -sizeY, 0);
        end.multiply(translate);
      }
    };

    sim.players.forEach((player, index) => {
      const p = proportions[index];
      if (!p) return;
      const speed = Math.hypot(player.vx, player.vz);
      const movingYaw = speed > 0.28 ? Math.atan2(player.vx, player.vz) : yaw.current[index] ?? 0;
      let yawDelta = movingYaw - (yaw.current[index] ?? 0);
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      yaw.current[index] = (yaw.current[index] ?? 0) + yawDelta * (1 - Math.exp(-10 * dt));
      phase.current[index] = (phase.current[index] ?? 0) + dt * (2.4 + speed * 1.28);

      const cycle = Math.sin(phase.current[index] ?? 0);
      const gait = Math.min(1, speed / 6.5);
      const stride = cycle * gait * (0.28 + gait * 0.52);
      const liftL = Math.max(0, -cycle) * gait;
      const liftR = Math.max(0, cycle) * gait;
      const acceleration = (speed - (previousSpeed.current[index] ?? speed)) / Math.max(dt, 1 / 120);
      previousSpeed.current[index] = speed;
      const lean = THREE.MathUtils.clamp(speed * 0.018 + acceleration * 0.006, -0.1, 0.2);
      const turnLean = THREE.MathUtils.clamp(-yawDelta * 0.7, -0.22, 0.22);
      const action = String(player.action ?? "");
      const kick = /shoot|pass|cross|clear/i.test(action) ? Math.sin(Math.PI * Math.max(0, 1 - player.actionT / Math.max(0.01, player.actionDur))) : 0;

      position.set(player.x, 0, player.z);
      quaternion.setFromEuler(euler.set(lean, yaw.current[index] ?? 0, turnLean, "YXZ"));
      root.compose(position, quaternion, unit);

      const hipY = p.hipY + Math.abs(cycle) * gait * 0.025;
      setPart(hipsRef.current as THREE.InstancedMesh, index, root, 0, hipY, 0, 0, 0, p.hipW * 3.4, p.hipH * 1.8, p.chestD * 1.6);
      setPart(torsoRef.current as THREE.InstancedMesh, index, root, 0, hipY + p.spineLen + p.chestLen * 0.48, 0, lean * 0.35, -turnLean * 0.35, p.chestW * 4.9, p.chestLen * 2.1, p.chestD * 4.5);
      setPart(headRef.current as THREE.InstancedMesh, index, root, 0, hipY + p.spineLen + p.chestLen + p.neckLen + p.headR * 1.8, 0, -lean * 0.35, 0, p.headR * 2, p.headR * 2.25, p.headR * 2.05);
      setPart(hairRef.current as THREE.InstancedMesh, index, root, 0, hipY + p.spineLen + p.chestLen + p.neckLen + p.headR * 2.25, -p.headR * 0.03, -lean * 0.35, 0, p.headR * 2.04, p.headR * 0.72, p.headR * 2.08);
      setPart(neckRef.current as THREE.InstancedMesh, index, root, 0, hipY + p.spineLen + p.chestLen + p.neckLen * 0.5, 0, -lean * 0.2, 0, p.neckR * 2, p.neckLen, p.neckR * 2);

      position.set(player.x, 0.014, player.z);
      quaternion.setFromEuler(euler.set(-Math.PI / 2, 0, -(yaw.current[index] ?? 0)));
      shadowScale.set(0.38 + gait * 0.08, 0.68 + gait * 0.12, 1);
      part.compose(position, quaternion, shadowScale);
      (shadowRef.current as THREE.InstancedMesh).setMatrixAt(index, part);

      for (const side of [-1, 1] as const) {
        const limbIndex = index * 2 + (side === -1 ? 0 : 1);
        const armPitch = -stride * 0.82 * side;
        setPart(armsRef.current as THREE.InstancedMesh, limbIndex, root, side * p.shoulderW, hipY + p.spineLen + p.chestLen * 0.85, 0, armPitch, side * 0.1, p.armR * 2, (p.upperArm + p.foreArm) * 0.92, p.armR * 2);

        const legPitch = side === -1 ? stride + kick * 0.95 : -stride;
        const knee = side === -1 ? liftL : liftR;
        setPart(thighsRef.current as THREE.InstancedMesh, limbIndex, root, side * p.hipW * 0.5, hipY, 0, legPitch, side * 0.025, p.legR * 2.15, p.thigh, p.legR * 2.15, thighEnd);
        const shinPitch = -knee * (0.55 + gait * 0.75) - kick * 0.35;
        setPart(shinsRef.current as THREE.InstancedMesh, limbIndex, thighEnd, 0, 0, 0, shinPitch, 0, p.legR * 1.82, p.shin, p.legR * 1.82, shinEnd);
        setPart(bootsRef.current as THREE.InstancedMesh, limbIndex, shinEnd, 0, 0, p.footLen * 0.2, 0.18 + knee * 0.2, 0, p.footH * 1.8, p.footH * 0.82, p.footLen * 1.25);
      }
    });

    for (const mesh of meshes) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  const material = <meshStandardMaterial color="#ffffff" roughness={0.78} metalness={0} />;
  return (
    <group>
      <instancedMesh ref={torsoRef} args={[undefined, undefined, BODY_PARTS]}>{material}<sphereGeometry args={[0.5, 7, 5]} /></instancedMesh>
      <instancedMesh ref={hipsRef} args={[undefined, undefined, BODY_PARTS]}>{material}<sphereGeometry args={[0.5, 7, 5]} /></instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, BODY_PARTS]}>{material}<sphereGeometry args={[0.5, 8, 6]} /></instancedMesh>
      <instancedMesh ref={hairRef} args={[undefined, undefined, BODY_PARTS]}>{material}<sphereGeometry args={[0.5, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.62]} /></instancedMesh>
      <instancedMesh ref={neckRef} args={[undefined, undefined, BODY_PARTS]}>{material}<cylinderGeometry args={[0.5, 0.5, 1, 6]} /></instancedMesh>
      <instancedMesh ref={armsRef} args={[undefined, undefined, LIMB_PARTS]}>{material}<cylinderGeometry args={[0.5, 0.42, 1, 6]} /></instancedMesh>
      <instancedMesh ref={thighsRef} args={[undefined, undefined, LIMB_PARTS]}>{material}<cylinderGeometry args={[0.5, 0.42, 1, 6]} /></instancedMesh>
      <instancedMesh ref={shinsRef} args={[undefined, undefined, LIMB_PARTS]}>{material}<cylinderGeometry args={[0.44, 0.34, 1, 6]} /></instancedMesh>
      <instancedMesh ref={bootsRef} args={[undefined, undefined, LIMB_PARTS]}>{material}<boxGeometry args={[1, 1, 1]} /></instancedMesh>
      <instancedMesh ref={shadowRef} args={[undefined, undefined, BODY_PARTS]} frustumCulled={false} renderOrder={1}>
        <circleGeometry args={[1, 14]} />
        <meshBasicMaterial color="#050806" transparent opacity={0.28} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}