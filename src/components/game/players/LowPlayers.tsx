import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Kit } from "@/game/kits";
import { gaitCadence, gaitPoseAt } from "@/game/gait-kinematics";
import { lowDetailBodyFor, lookFor, proportionsFor } from "@/game/player-model";
import type { SimView } from "@/game/sim";
import {
  emptyActionContext,
  emptyContactContext,
  type ActionContext,
  type ContactContext,
} from "@/game/visual-context";
import { visualDataFor } from "@/game/visual-frame-cache";
import { censusRef } from "@/game/scene-census";

type LowPlayersProps = {
  sim: SimView;
  homeKit: Kit;
  awayKit: Kit;
  homeGkKit: Kit;
  awayGkKit: Kit;
  excluded?: ReadonlySet<string>;
  simplified?: boolean;
};

const BODY_PARTS = 22;
const LIMB_PARTS = BODY_PARTS * 2;
const PELVIS_CAPSULE_HEIGHT = 1.48;

function createTaperedTorsoGeometry(): THREE.BufferGeometry {
  const rings = [
    { y: -0.5, x: 0.34, z: 0.42 },
    { y: -0.32, x: 0.38, z: 0.48 },
    { y: -0.08, x: 0.43, z: 0.5 },
    { y: 0.18, x: 0.49, z: 0.47 },
    { y: 0.36, x: 0.5, z: 0.42 },
    { y: 0.5, x: 0.25, z: 0.32 },
  ];
  const radialSegments = 12;
  const positions: number[] = [];
  const indices: number[] = [];

  rings.forEach((ring) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(angle) * ring.x, ring.y, Math.sin(angle) * ring.z);
    }
  });
  positions.push(0, rings[0]!.y, 0, 0, rings[rings.length - 1]!.y, 0);

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      const lower = ring * radialSegments + segment;
      const lowerNext = ring * radialSegments + next;
      const upper = (ring + 1) * radialSegments + segment;
      const upperNext = (ring + 1) * radialSegments + next;
      indices.push(lower, upper, lowerNext, lowerNext, upper, upperNext);
    }
  }

  const bottomCenter = rings.length * radialSegments;
  const topCenter = bottomCenter + 1;
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments;
    indices.push(bottomCenter, segment, next);
    const top = (rings.length - 1) * radialSegments;
    indices.push(topCenter, top + next, top + segment);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Corpo articulado de transmissão para aparelhos fracos.
 * Os 22 atletas compartilham oito desenhos instanciados, em vez de criarem
 * centenas de objetos individuais. A silhueta continua articulada em quadril,
 * ombros, cotovelos, joelhos e tornozelos.
 */
export function LowPlayers({
  sim,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  excluded,
}: LowPlayersProps) {
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
  const phaseSeeded = useRef(new Uint8Array(BODY_PARTS));
  const yaw = useRef(new Float32Array(BODY_PARTS));
  const previousSpeed = useRef(new Float32Array(BODY_PARTS));
  const tmp = useMemo(
    () => ({
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
    }),
    [],
  );

  const looks = useMemo(
    () => sim.players.map((player) => lookFor(player.id, player.pos, player.number === 10)),
    [sim.players],
  );
  const proportions = useMemo(() => looks.map(proportionsFor), [looks]);
  const lowBodies = useMemo(() => proportions.map(lowDetailBodyFor), [proportions]);
  const torsoGeometry = useMemo(() => createTaperedTorsoGeometry(), []);

  useEffect(() => () => torsoGeometry.dispose(), [torsoGeometry]);

  useEffect(() => {
    sim.players.forEach((player, index) => {
      const kit =
        player.pos === "GK"
          ? player.side === "home"
            ? homeGkKit
            : awayGkKit
          : player.side === "home"
            ? homeKit
            : awayKit;
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
        sleevesRef.current?.setColorAt(
          limbIndex,
          new THREE.Color(kit.pattern === "sleeves" ? kit.detail : kit.base),
        );
        thighsRef.current?.setColorAt(limbIndex, new THREE.Color(kit.shorts));
        shinsRef.current?.setColorAt(limbIndex, new THREE.Color(kit.socks));
      }
    });
    for (const mesh of [
      torsoRef.current,
      hipsRef.current,
      headRef.current,
      hairRef.current,
      armsRef.current,
      sleevesRef.current,
      thighsRef.current,
      shinsRef.current,
      bootsRef.current,
      neckRef.current,
      shadowRef.current,
    ]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (mesh) mesh.frustumCulled = false;
    }
  }, [awayGkKit, awayKit, homeGkKit, homeKit, looks, sim.players]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const meshes = [
      torsoRef.current,
      hipsRef.current,
      headRef.current,
      hairRef.current,
      armsRef.current,
      sleevesRef.current,
      thighsRef.current,
      shinsRef.current,
      bootsRef.current,
      neckRef.current,
      shadowRef.current,
    ];
    if (meshes.some((mesh) => !mesh)) return;

    // Obtém contexto visual do sim (se disponível)
    const visualCtx = visualDataFor(sim);

    const {
      root,
      joint,
      part,
      translate,
      rotate,
      scale,
      thighEnd,
      shinEnd,
      position,
      shadowScale,
      quaternion,
      euler,
      unit,
    } = tmp;
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
    const setCenteredPart = (
      mesh: THREE.InstancedMesh,
      index: number,
      parent: THREE.Matrix4,
      offsetX: number,
      offsetY: number,
      offsetZ: number,
      pitch: number,
      yaw: number,
      roll: number,
      sizeX: number,
      sizeY: number,
      sizeZ: number,
    ) => {
      translate.makeTranslation(offsetX, offsetY, offsetZ);
      joint.multiplyMatrices(parent, translate);
      quaternion.setFromEuler(euler.set(pitch, yaw, roll));
      rotate.makeRotationFromQuaternion(quaternion);
      part.multiplyMatrices(joint, rotate);
      scale.makeScale(sizeX, sizeY, sizeZ);
      part.multiply(scale);
      mesh.setMatrixAt(index, part);
    };

    sim.players.forEach((player, index) => {
      const p = proportions[index];
      const body = lowBodies[index];
      const look = looks[index];
      if (!p || !body) return;
      if (excluded?.has(player.id)) {
        tmp.part.makeScale(0, 0, 0);
        for (const mesh of [
          torsoRef.current,
          hipsRef.current,
          headRef.current,
          hairRef.current,
          neckRef.current,
          shadowRef.current,
        ])
          mesh?.setMatrixAt(index, tmp.part);
        for (const mesh of [
          armsRef.current,
          sleevesRef.current,
          thighsRef.current,
          shinsRef.current,
          bootsRef.current,
        ]) {
          mesh?.setMatrixAt(index * 2, tmp.part);
          mesh?.setMatrixAt(index * 2 + 1, tmp.part);
        }
        return;
      }

      // Obtém ActionContext e ContactContext para este jogador
      const actionContext: ActionContext =
        visualCtx && index >= 0 && index < visualCtx.actionContexts.length
          ? (visualCtx.actionContexts[index] ?? emptyActionContext())
          : emptyActionContext();
      const contactContext: ContactContext =
        visualCtx && index >= 0 && index < visualCtx.contactContexts.length
          ? (visualCtx.contactContexts[index] ?? emptyContactContext())
          : emptyContactContext();

      const action = String(player.action ?? "");
      const hasKick = /shoot|pass|cross|clear/i.test(action);
      let kick = 0;
      if (actionContext.action && player.action) {
        const progress =
          actionContext.actionDur > 0
            ? Math.max(0, Math.min(1, 1 - actionContext.actionT / actionContext.actionDur))
            : 0;
        kick = hasKick ? Math.sin(Math.PI * progress) : 0;
      }

      const speed = Math.hypot(player.vx, player.vz);
      const movingYaw = speed > 0.28 ? Math.atan2(player.vx, player.vz) : (yaw.current[index] ?? 0);
      let yawDelta = movingYaw - (yaw.current[index] ?? 0);
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      const previousYaw = yaw.current[index] ?? 0;
      const nextYaw = previousYaw + yawDelta * (1 - Math.exp(-10 * dt));
      yaw.current[index] = nextYaw;
      const yawRate = (nextYaw - previousYaw) / Math.max(dt, 1 / 120);

      if (!phaseSeeded.current[index]) {
        const seed = look?.seed ?? index * 193;
        phase.current[index] = ((Math.abs(seed) % 997) / 997) * Math.PI * 2;
        phaseSeeded.current[index] = 1;
      }
      phase.current[index] = (phase.current[index] ?? 0) + gaitCadence(speed) * Math.PI * 2 * dt;
      const gaitPose = gaitPoseAt(phase.current[index] ?? 0, speed);
      const acceleration =
        (speed - (previousSpeed.current[index] ?? speed)) / Math.max(dt, 1 / 120);
      previousSpeed.current[index] = speed;
      const lean = THREE.MathUtils.clamp(speed * 0.028 + acceleration * 0.006, -0.1, 0.22);
      const turnLean = THREE.MathUtils.clamp(-yawRate * 0.09 * Math.min(1, speed / 5), -0.22, 0.22);

      position.set(player.x, 0, player.z);
      quaternion.setFromEuler(euler.set(-lean, nextYaw, turnLean, "YXZ"));
      root.compose(position, quaternion, unit);

      const hipY = p.hipY + gaitPose.hipBob;
      setCenteredPart(
        hipsRef.current as THREE.InstancedMesh,
        index,
        root,
        0,
        hipY,
        0,
        0,
        gaitPose.torsoCounterRotation * 0.45,
        0,
        body.pelvisWidth,
        body.pelvisHeight / PELVIS_CAPSULE_HEIGHT,
        body.pelvisDepth,
      );
      setCenteredPart(
        torsoRef.current as THREE.InstancedMesh,
        index,
        root,
        0,
        body.torsoCenterY + gaitPose.hipBob,
        0,
        lean * 0.28,
        gaitPose.torsoCounterRotation,
        -turnLean * 0.2,
        body.torsoWidth,
        body.torsoHeight,
        body.torsoDepth,
      );
      let headYaw = Math.atan2(sim.ball.x - player.x, sim.ball.z - player.z) - nextYaw;
      while (headYaw > Math.PI) headYaw -= Math.PI * 2;
      while (headYaw < -Math.PI) headYaw += Math.PI * 2;
      headYaw = THREE.MathUtils.clamp(headYaw * 0.65, -0.72, 0.72);
      setCenteredPart(
        headRef.current as THREE.InstancedMesh,
        index,
        root,
        0,
        body.headCenterY + gaitPose.hipBob,
        0,
        -lean * 0.12,
        headYaw,
        0,
        p.headW * 2,
        p.headR * 2.28,
        p.headD * 2,
      );
      const hairStyle = look?.hairStyle ?? "short";
      const hairVolume = look?.hairVolume ?? 1;
      const isCoily = hairStyle === "afro" || hairStyle === "curly";
      const hairHeight =
        hairStyle === "afro"
          ? 1.24
          : hairStyle === "curly"
            ? 1.1
            : hairStyle === "mohawk"
              ? 0.62
              : 1.04;
      const hairCenterY =
        body.headCenterY +
        gaitPose.hipBob +
        p.headR * (hairStyle === "mohawk" ? 0.95 : isCoily ? 0.42 : 0.16);
      const hairWidth =
        hairStyle === "afro"
          ? 1.16
          : hairStyle === "curly"
            ? 1.08
            : hairStyle === "mohawk"
              ? 0.48
              : 1.02;
      const noHair = hairStyle === "bald";
      setCenteredPart(
        hairRef.current as THREE.InstancedMesh,
        index,
        root,
        0,
        hairCenterY,
        -p.headR * 0.03,
        -lean * 0.1,
        headYaw * 0.82,
        gaitPose.torsoCounterRotation * 0.2,
        noHair ? 0 : p.headR * 2 * hairWidth * (0.9 + hairVolume * 0.1),
        noHair ? 0 : p.headR * 2 * hairHeight * hairVolume,
        noHair ? 0 : p.headR * 2 * hairWidth * (0.9 + hairVolume * 0.1),
      );
      setCenteredPart(
        neckRef.current as THREE.InstancedMesh,
        index,
        root,
        0,
        body.neckCenterY + gaitPose.hipBob,
        0,
        -lean * 0.1,
        0,
        0,
        p.neckR * 2,
        p.neckLen,
        p.neckR * 2,
      );

      position.set(player.x, 0.014, player.z);
      quaternion.setFromEuler(euler.set(-Math.PI / 2, 0, -(yaw.current[index] ?? 0)));
      shadowScale.set(0.38 + gaitPose.intensity * 0.08, 0.68 + gaitPose.intensity * 0.12, 1);
      part.compose(position, quaternion, shadowScale);
      (shadowRef.current as THREE.InstancedMesh).setMatrixAt(index, part);

      // Contato de apoio refina a passada sem travar as pernas quando a engine
      // não tem um contato físico específico para este jogador.
      const groundFoot = contactContext.groundFoot;
      const hasGroundContact =
        contactContext.type === "ground" || contactContext.type === "groundBall";
      const contactForce = hasGroundContact ? THREE.MathUtils.clamp(contactContext.force, 0, 1) : 0;
      const usedFoot = actionContext.usedFoot;

      for (const side of [-1, 1] as const) {
        const limbIndex = index * 2 + (side === -1 ? 0 : 1);
        // O pivô esquerdo do rig principal fica em +X; manter o mesmo lado
        // garante que contatos e ações acertem o pé correto após a troca de LOD.
        const isLeft = side === 1;
        const footPose = isLeft ? gaitPose.left : gaitPose.right;
        const sideFoot = isLeft ? "left" : "right";
        const grounded = hasGroundContact && (groundFoot === null || groundFoot === sideFoot);
        const supportFactor = grounded ? 1 - contactForce * 0.35 : 1;
        const isKickingFoot = hasKick && usedFoot === sideFoot;
        const armPitch = gaitPose.armCounterSwing * (isLeft ? 1 : -1);
        const shoulderY = hipY + p.hipH * 0.5 + p.spineLen + p.chestLen * 0.84;
        const shoulderX = side * p.shoulderW * 0.52;
        setPart(
          armsRef.current as THREE.InstancedMesh,
          limbIndex,
          root,
          shoulderX,
          shoulderY,
          0,
          armPitch,
          side * 0.1,
          p.armR * 2,
          (p.upperArm + p.foreArm) * 0.92,
          p.armR * 2,
        );
        // manga curta da camisa cobrindo o topo do braço
        setPart(
          sleevesRef.current as THREE.InstancedMesh,
          limbIndex,
          root,
          shoulderX,
          shoulderY + 0.012,
          0,
          armPitch,
          side * 0.1,
          p.armR * 2.42,
          p.upperArm * 0.58,
          p.armR * 2.42,
        );

        const legPitch = footPose.stride * supportFactor + (isKickingFoot ? kick * 0.95 : 0);
        const knee = footPose.kneeFlex * supportFactor;

        setPart(
          thighsRef.current as THREE.InstancedMesh,
          limbIndex,
          root,
          side * p.hipW * 0.46,
          hipY - p.hipH * 0.4,
          0,
          legPitch,
          side * 0.025,
          p.legR * 2.15,
          p.thigh,
          p.legR * 2.15,
          thighEnd,
        );
        const shinPitch =
          -knee * (0.55 + gaitPose.intensity * 0.75) - (isKickingFoot ? kick * 0.35 : 0);
        setPart(
          shinsRef.current as THREE.InstancedMesh,
          limbIndex,
          thighEnd,
          0,
          0,
          0,
          shinPitch,
          0,
          p.legR * 1.82,
          p.shin,
          p.legR * 1.82,
          shinEnd,
        );

        const footContactOffset = grounded ? contactForce * 0.05 : 0;
        setPart(
          bootsRef.current as THREE.InstancedMesh,
          limbIndex,
          shinEnd,
          0,
          0,
          p.footLen * 0.2,
          footPose.anklePitch + knee * 0.12 + footContactOffset,
          0,
          p.footH * 1.8,
          p.footH * 0.82,
          p.footLen * 1.25,
        );
      }
    });

    for (const mesh of meshes) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // Tecido, pele e couro têm respostas de luz diferentes: separar os três dá
  // volume real aos atletas sem custar desenho extra (o número de lotes é o mesmo).
  const cloth = (
    <meshStandardMaterial color="#ffffff" roughness={0.82} metalness={0} envMapIntensity={0.55} />
  );
  const skin = (
    <meshStandardMaterial color="#ffffff" roughness={0.58} metalness={0} envMapIntensity={0.75} />
  );
  const leather = (
    <meshStandardMaterial color="#ffffff" roughness={0.36} metalness={0.06} envMapIntensity={0.9} />
  );
  return (
    <group ref={censusRef("playerLow")}>
      <instancedMesh ref={torsoRef} args={[torsoGeometry, undefined, BODY_PARTS]} castShadow>
        {cloth}
      </instancedMesh>
      <instancedMesh ref={hipsRef} args={[undefined, undefined, BODY_PARTS]} castShadow>
        {cloth}
        <capsuleGeometry args={[0.5, 0.48, 4, 8]} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, BODY_PARTS]}>
        {skin}
        <sphereGeometry args={[0.5, 10, 8]} />
      </instancedMesh>
      <instancedMesh ref={hairRef} args={[undefined, undefined, BODY_PARTS]}>
        {cloth}
        <sphereGeometry args={[0.5, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
      </instancedMesh>
      <instancedMesh ref={neckRef} args={[undefined, undefined, BODY_PARTS]}>
        {skin}
        <cylinderGeometry args={[0.5, 0.5, 1, 6]} />
      </instancedMesh>
      <instancedMesh ref={armsRef} args={[undefined, undefined, LIMB_PARTS]}>
        {skin}
        <cylinderGeometry args={[0.5, 0.42, 1, 7]} />
      </instancedMesh>
      <instancedMesh ref={sleevesRef} args={[undefined, undefined, LIMB_PARTS]}>
        {cloth}
        <cylinderGeometry args={[0.5, 0.46, 1, 7]} />
      </instancedMesh>
      <instancedMesh ref={thighsRef} args={[undefined, undefined, LIMB_PARTS]} castShadow>
        {cloth}
        <cylinderGeometry args={[0.5, 0.42, 1, 7]} />
      </instancedMesh>
      <instancedMesh ref={shinsRef} args={[undefined, undefined, LIMB_PARTS]}>
        {cloth}
        <cylinderGeometry args={[0.44, 0.34, 1, 7]} />
      </instancedMesh>
      <instancedMesh ref={bootsRef} args={[undefined, undefined, LIMB_PARTS]}>
        {leather}
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={shadowRef}
        args={[undefined, undefined, BODY_PARTS]}
        frustumCulled={false}
        renderOrder={1}
      >
        <circleGeometry args={[1, 14]} />
        <meshBasicMaterial color="#050806" transparent opacity={0.28} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
