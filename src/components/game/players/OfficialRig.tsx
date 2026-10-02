import { createPortal, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { applyOfficialLegPose, buildOfficialRig } from "@/game/official-rig";
import { emptyPose } from "@/game/animation-core";
import { gaitPoseAt } from "@/game/gait-kinematics";
import { clampPoseAnatomy, solveGroundContact } from "@/game/ground-contact";
import { shoulderPose } from "@/game/athlete-posture";
import { updateRigCorrectives } from "@/game/rig-correctives";
import {
  officialCue,
  type OfficialCounts,
  type OfficialCue,
  type OfficialRole,
} from "@/game/official-presentation";
import { FIELD_X, FIELD_Z, type SimView } from "@/game/sim";
import { censusRef } from "@/game/scene-census";

/** Officials share the athlete's anatomical skeleton, joint corrections and
 * planted gait. A single compact LOD omits portrait detail at match distances. */
export function OfficialRig({
  sim,
  role,
  quality,
}: {
  sim: SimView;
  role: OfficialRole;
  quality: "alta" | "media" | "baixa";
}) {
  const root = useRef<THREE.Group>(null);
  const card = useRef<THREE.Mesh>(null);
  const flag = useRef<THREE.Group>(null);
  const spray = useRef<THREE.Mesh>(null);
  const data = useMemo(() => {
    const { p, skin, materials } = buildOfficialRig(role, sim.home.primary, sim.away.primary);
    const meshes = skin.groups
      .filter((group) => group.lod === "core" || group.lod === "near")
      .map((part) => {
        const mesh = new THREE.SkinnedMesh(part.geometry, part.material);
        mesh.name = `official-${part.lod}`;
        mesh.visible = part.lod === "core";
        mesh.skeleton = skin.skeleton;
        mesh.bindMatrix.copy(skin.bindMatrix);
        mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        mesh.frustumCulled = false;
        return mesh;
      });
    return {
      p,
      skin,
      materials,
      meshes,
      cast: false,
      near: false,
      pose: emptyPose(),
      counts: null as OfficialCounts | null,
      cue: "none" as OfficialCue,
      remaining: 0,
      phase: 0,
      rootY: 0,
      sprayUntil: 0,
      time: 0,
    };
  }, [role, sim.home.primary, sim.away.primary]);
  useEffect(
    () => () => {
      data.skin.dispose();
      data.materials.forEach((material) => material.dispose());
    },
    [data],
  );
  useFrame(({ camera }, rawDt) => {
    const group = root.current;
    if (!group) return;
    const dt = Math.min(rawDt, 0.05);
    const live = sim as SimView & { paused?: boolean };
    if (live.paused) return;
    data.time += dt;
    const ball = sim.visualBall ?? sim.ball;
    const h = sim.stats.home,
      a = sim.stats.away;
    const next = {
      cards: h.yellow + a.yellow + h.red + a.red,
      reds: h.red + a.red,
      goals: h.goals + a.goals,
      offsides: h.offsides + a.offsides,
      fouls: h.fouls + a.fouls,
    };
    const cue = data.counts ? officialCue(data.counts, next, role) : "none";
    data.counts = next;
    if (cue !== "none") {
      data.cue = cue;
      data.remaining = cue === "red" ? 3.4 : 2.4;
      if (cue === "foul" && spray.current) {
        spray.current.position.set(ball.x, 0.019, ball.z);
        data.sprayUntil = data.time + 8;
      }
    }
    data.remaining = Math.max(0, data.remaining - dt);
    const showing = data.remaining > 0;
    const signaling = showing && (role === "ref" || data.cue === "offside");
    const targetX = THREE.MathUtils.clamp(
      role === "ref" ? ball.x * 0.84 - 5 : ball.x * 0.85,
      -FIELD_X + 1,
      FIELD_X - 1,
    );
    const targetZ =
      role === "ref"
        ? THREE.MathUtils.clamp(ball.z * 0.55 + 7, -FIELD_Z + 1, FIELD_Z - 1)
        : (role === "ar1" ? 1 : -1) * (FIELD_Z + 1.6);
    const dx = targetX - group.position.x,
      dz = targetZ - group.position.z;
    const distance = Math.hypot(dx, dz),
      speed = signaling ? 0 : Math.min(6.8, distance * 1.7);
    if (distance > 0.05) {
      group.position.x += (dx / distance) * speed * dt;
      group.position.z += (dz / distance) * speed * dt;
    }
    const yaw =
      speed > 1.5
        ? Math.atan2(dx, dz)
        : Math.atan2(ball.x - group.position.x, ball.z - group.position.z);
    group.rotation.y +=
      Math.atan2(Math.sin(yaw - group.rotation.y), Math.cos(yaw - group.rotation.y)) *
      (1 - Math.exp(-dt * 9));
    const gait = gaitPoseAt(data.phase, speed, data.p, data.pose);
    data.phase += gait.cadence * dt * Math.PI * 2;
    const pose = data.pose;
    const gestureWeight = showing ? Math.min(1, data.remaining * 4) : 0;
    if (showing && role === "ref") {
      if (data.cue === "yellow" || data.cue === "red") {
        pose.armRPitch = -2.6 * gestureWeight;
        pose.elbowR = -0.2;
        pose.armRRoll = -0.15;
      }
      if (data.cue === "goal") {
        pose.armRPitch = -1.3 * gestureWeight;
        pose.elbowR = -0.1;
      }
      if (data.cue === "foul") {
        pose.armLPitch = -1.7 * gestureWeight;
        pose.elbowL = -1.2;
      }
    }
    if (showing && role !== "ref" && data.cue === "offside") {
      pose.armRPitch = -2.75 * gestureWeight;
      pose.elbowR = -0.15;
    }
    clampPoseAnatomy(pose);
    const contact = solveGroundContact({
      pose,
      P: data.p,
      hipShiftX: 0,
      leanX: 0,
      leanZ: 0,
      airborne: 0,
      previousRootY: data.rootY,
      dt,
    });
    data.rootY = contact.rootY;
    group.position.y = contact.rootY;
    const b = data.skin.boneOf;
    b.hips.position.y = data.p.hipY + pose.hipY;
    b.hips.rotation.set(pose.hipPitch, pose.hipYaw, pose.hipRoll);
    b.spine.rotation.x = pose.spine;
    b.chest.rotation.x = pose.chest;
    const neckYaw =
      Math.atan2(ball.x - group.position.x, ball.z - group.position.z) - group.rotation.y;
    b.neck.rotation.y = THREE.MathUtils.clamp(
      Math.atan2(Math.sin(neckYaw), Math.cos(neckYaw)),
      -0.5,
      0.5,
    );
    const left = shoulderPose(pose.armLPitch, pose.armLRoll),
      right = shoulderPose(pose.armRPitch, pose.armRRoll);
    b.clavL.rotation.set(left.clavPitch, 0, left.clavRoll);
    b.clavR.rotation.set(right.clavPitch, 0, right.clavRoll);
    b.armL.rotation.set(left.armPitch, left.armYaw, left.armRoll);
    b.armR.rotation.set(right.armPitch, right.armYaw, right.armRoll);
    b.foreL.rotation.x = pose.elbowL;
    b.foreR.rotation.x = pose.elbowR;
    applyOfficialLegPose(b, pose, contact);
    updateRigCorrectives(b);
    if (card.current) {
      card.current.visible =
        showing && role === "ref" && (data.cue === "yellow" || data.cue === "red");
      (card.current.material as THREE.MeshBasicMaterial).color.set(
        data.cue === "red" ? "#ec3030" : "#ffd83c",
      );
    }
    if (flag.current) flag.current.visible = role !== "ref";
    if (spray.current) {
      spray.current.visible = data.time < data.sprayUntil;
      (spray.current.material as THREE.MeshBasicMaterial).opacity = Math.min(
        0.7,
        (data.sprayUntil - data.time) / 3,
      );
    }
    const cameraDistance = camera.position.distanceTo(group.position);
    const near = quality !== "baixa" && cameraDistance < 22;
    if (near !== data.near) {
      data.near = near;
      data.meshes.forEach((mesh) => {
        if (mesh.name === "official-near") mesh.visible = near;
      });
    }
    const cast = quality === "alta" && cameraDistance < 34;
    if (cast !== data.cast) {
      data.cast = cast;
      data.meshes.forEach((mesh) => {
        mesh.castShadow = cast;
      });
    }
  });
  return (
    <>
      <group
        ref={root}
        position={[0, 0, role === "ref" ? 8 : (role === "ar1" ? 1 : -1) * (FIELD_Z + 1.6)]}
        dispose={null}
      >
        <group ref={censusRef("other")}>
          <primitive object={data.skin.root} />
          {data.meshes.map((mesh, i) => (
            <primitive key={i} object={mesh} />
          ))}
        </group>
        {createPortal(
          <group>
            <mesh ref={card} position={[0, -data.p.handR * 1.7, 0.04]} visible={false}>
              <planeGeometry args={[0.1, 0.15]} />
              <meshBasicMaterial side={THREE.DoubleSide} />
            </mesh>
            {role !== "ref" ? (
              <group ref={flag} rotation={[0, 0, -0.25]}>
                <mesh position={[0, -0.2, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.4, 5]} />
                  <meshStandardMaterial color="#263339" />
                </mesh>
                <mesh position={[0.13, -0.31, 0]}>
                  <planeGeometry args={[0.26, 0.2]} />
                  <meshBasicMaterial color="#ffc43c" side={THREE.DoubleSide} />
                </mesh>
              </group>
            ) : null}
          </group>,
          data.skin.boneOf.handR,
        )}
      </group>
      {role === "ref" ? (
        <mesh ref={spray} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <planeGeometry args={[3.2, 0.14]} />
          <meshBasicMaterial color="#f4f7fa" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ) : null}
    </>
  );
}
