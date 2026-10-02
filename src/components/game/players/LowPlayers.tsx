import { useFrame } from "@react-three/fiber";
import { createElement, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { emptyPose, getClip, mixPose, selectClip, type ClipName } from "@/game/animation";
import { gaitPoseAt, locomotionWeight } from "@/game/gait-kinematics";
import { airborneFactor, clampPoseAnatomy, solveGroundContact } from "@/game/ground-contact";
import type { Kit } from "@/game/kits";
import {
  lowDetailBodyFor,
  lookFor,
  lookWithPhysique,
  proportionsFor,
  type PlayerLook,
} from "@/game/player-model";
import { LOW_HAIR_FAMILIES, lowHairFamily } from "@/game/player-lod-hair";
import { createLowPlayerGeometries } from "@/game/player-lod-geometry";
import { LowShortsAnimator } from "@/game/player-lod-shorts";
import { skinAlbedo } from "@/game/player-morphology";
import {
  appendPlayerInstance,
  capturePlayerPalette,
  type PlayerInstancePalette,
} from "@/game/player-instance-batch";
import { censusRef } from "@/game/scene-census";
import type { SimView } from "@/game/sim";
import { visualMotionFor } from "@/game/visual-motion";
import { footballSupportFor, refineFootballAction } from "@/game/football-action";
import { refineAthletePosture, shoulderPose } from "@/game/athlete-posture";
import { spineRollForAction } from "@/game/rig-correctives";
import { visualDataFor } from "@/game/visual-frame-cache";
import { getDominantFoot } from "@/game/visual-context";
import { AthletePoseBlender } from "@/game/athlete-pose-blender";

type LowPlayersProps = {
  sim: SimView;
  homeKit: Kit;
  awayKit: Kit;
  homeGkKit: Kit;
  awayGkKit: Kit;
  excluded?: ReadonlySet<string>;
  simplified?: boolean;
  paused?: boolean;
  previewAt?: number | undefined;
  lookOverrides?: ReadonlyMap<string, PlayerLook> | undefined;
  previewClip?: ClipName | undefined;
};
const MAX_PLAYERS = 22;
const SOCK_BATCHES = ["socksLow", "socksMid", "socksHigh"] as const;
const SOCK_TOP = { socksLow: 0.62, socksMid: 0.38, socksHigh: 0.15 } as const;
const BODY_BATCHES = ["torso", "hips", "head", ...LOW_HAIR_FAMILIES, "neck", "shadow"] as const;
const LIMB_BATCHES = [
  "arms",
  "forearms",
  "hands",
  "sleeves",
  "thighs",
  "shins",
  ...SOCK_BATCHES,
  "boots",
] as const;
type Batch = (typeof BODY_BATCHES)[number] | (typeof LIMB_BATCHES)[number];

/** Shared anatomy and movement, drawn as a small set of instanced surfaces. */
export function LowPlayers({
  sim,
  homeKit,
  awayKit,
  homeGkKit,
  awayGkKit,
  excluded,
  paused = false,
  previewAt,
  lookOverrides,
  previewClip,
}: LowPlayersProps) {
  const refs = useRef<Partial<Record<Batch, THREE.InstancedMesh>>>({});
  const palettes = useRef<Partial<Record<Batch, PlayerInstancePalette>>>({});
  const painted = useRef(false);
  const sampled = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    painted.current = false;
  }, [sim.players, lookOverrides]);
  const looks = useMemo(
    () =>
      sim.players.map(
        (p) =>
          lookOverrides?.get(p.id) ??
          lookWithPhysique(lookFor(p.pid, p.pos, p.number === 10), {
            height: p.heightCm,
            weight: p.weightKg,
          }),
      ),
    [sim.players, lookOverrides],
  );
  const proportions = useMemo(() => looks.map(proportionsFor), [looks]);
  const shapes = useMemo(() => proportions.map(lowDetailBodyFor), [proportions]);
  const poseBlenders = useMemo(
    () => sim.players.map(() => new AthletePoseBlender()),
    [sim.players],
  );
  const geometries = useMemo(createLowPlayerGeometries, []);
  const shortsAnimator = useMemo(() => new LowShortsAnimator(geometries["hips"]!), [geometries]);
  const gaitBuffer = useRef(emptyPose());
  const rootY = useRef(new Float32Array(MAX_PLAYERS));
  const tmp = useMemo(
    () => ({
      root: new THREE.Matrix4(),
      hips: new THREE.Matrix4(),
      spine: new THREE.Matrix4(),
      chest: new THREE.Matrix4(),
      neck: new THREE.Matrix4(),
      head: new THREE.Matrix4(),
      arm: new THREE.Matrix4(),
      clavicle: new THREE.Matrix4(),
      fore: new THREE.Matrix4(),
      thigh: new THREE.Matrix4(),
      shin: new THREE.Matrix4(),
      ankle: new THREE.Matrix4(),
      part: new THREE.Matrix4(),
      local: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(),
    }),
    [],
  );
  useEffect(
    () => () => {
      shortsAnimator.dispose();
      Object.values(geometries).forEach((geometry) => geometry.dispose());
    },
    [geometries, shortsAnimator],
  );
  useEffect(() => {
    const color = new THREE.Color();
    sim.players.slice(0, MAX_PLAYERS).forEach((player, index) => {
      const look = looks[index]!;
      const skinColor = skinAlbedo(look.skin);
      const kit =
        player.pos === "GK"
          ? player.side === "home"
            ? homeGkKit
            : awayGkKit
          : player.side === "home"
            ? homeKit
            : awayKit;
      const set = (batch: Batch, i: number, hex: string) =>
        refs.current[batch]?.setColorAt(i, color.set(hex));
      set("torso", index, kit.base);
      set("hips", index, kit.shorts);
      set("head", index, skinColor);
      set("neck", index, skinColor);
      for (const family of LOW_HAIR_FAMILIES) set(family, index, look.hairColor);
      for (let side = 0; side < 2; side++) {
        const i = index * 2 + side;
        set("arms", i, skinColor);
        set("forearms", i, look.sleeves === "long" ? kit.base : skinColor);
        set("hands", i, look.gloves ? look.gloveColor : skinColor);
        set("sleeves", i, kit.pattern === "sleeves" ? kit.detail : kit.base);
        set("thighs", i, skinColor);
        set("shins", i, skinColor);
        for (const sockBatch of SOCK_BATCHES) set(sockBatch, i, kit.socks);
        set("boots", i, look.bootColor);
      }
    });
    for (const [name, mesh] of Object.entries(refs.current)) {
      palettes.current[name as Batch] = capturePlayerPalette(mesh);
      mesh.count = 0;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
    }
    painted.current = false;
  }, [sim.players, looks, homeKit, awayKit, homeGkKit, awayGkKit]);
  useFrame(({ clock }, rawDt) => {
    // A model mounted while paused still needs its first set of matrices.
    if (paused && painted.current && sampled.current === previewAt) return;
    sampled.current = previewAt;
    painted.current = true;
    const dt = Math.min(rawDt, 0.1);
    const meshes = refs.current;
    for (const mesh of Object.values(meshes)) mesh.count = 0;
    const commit = (batch: Batch, source: number) => {
      const mesh = meshes[batch];
      const palette = palettes.current[batch];
      if (mesh && palette) appendPlayerInstance(mesh, palette, source, part);
    };
    const visual = visualDataFor(sim);
    const {
      root,
      hips,
      spine,
      chest,
      neck,
      head,
      clavicle,
      arm,
      fore,
      thigh,
      shin,
      ankle,
      part,
      local,
      position,
      scale,
      quaternion,
      euler,
    } = tmp;
    const joint = (
      out: THREE.Matrix4,
      parent: THREE.Matrix4,
      x: number,
      y: number,
      z: number,
      pitch = 0,
      yaw = 0,
      roll = 0,
    ) => {
      position.set(x, y, z);
      scale.set(1, 1, 1);
      quaternion.setFromEuler(euler.set(pitch, yaw, roll, "XYZ"));
      local.compose(position, quaternion, scale);
      out.multiplyMatrices(parent, local);
    };
    const draw = (
      batch: Batch,
      i: number,
      parent: THREE.Matrix4,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      if (sx === 0 || sy === 0 || sz === 0) return;
      position.set(x, y, z);
      quaternion.identity();
      scale.set(sx, sy, sz);
      local.compose(position, quaternion, scale);
      part.multiplyMatrices(parent, local);
      commit(batch, i);
    };
    sim.players.slice(0, MAX_PLAYERS).forEach((player, index) => {
      if (excluded?.has(player.id) || player.sentOff) return;
      const p = proportions[index]!;
      const shape = shapes[index]!;
      const look = looks[index]!;
      const motion = visualMotionFor(
        sim,
        player,
        sim.ball,
        look.seed,
        p.thigh + p.shin,
        clock.elapsedTime,
        sim.possession !== player.side &&
          Math.hypot(sim.ball.x - player.x, sim.ball.z - player.z) < 12,
      );
      const speed = motion.speed;
      const clip =
        previewClip ??
        selectClip({
          isGK: player.pos === "GK",
          action: player.action,
          speed,
          hasBall: sim.ball.holder === player.id,
          ballDist: Math.hypot(sim.ball.x - player.x, sim.ball.z - player.z),
          stamina: player.stamina,
          defending: sim.possession !== player.side,
          stopped: speed < 0.35,
          seed: look.seed % 97,
          time: sim.time,
        });
      const u =
        previewAt ??
        (player.action && player.actionDur > 0
          ? Math.max(0, Math.min(1, 1 - player.actionT / player.actionDur))
          : (clock.elapsedTime % 1.4) / 1.4);
      const authored = getClip(clip)({
        t: previewAt !== undefined ? previewAt * (player.actionDur || 1.4) : clock.elapsedTime,
        u,
        speed,
        stride: Math.min(1, speed / 7),
        seed: look.seed % 97,
      });
      const gaitWeight = locomotionWeight(speed, player.action, clip);
      if (gaitWeight > 0)
        mixPose(
          authored,
          gaitPoseAt(motion.phase, speed, p, gaitBuffer.current, {
            forward: motion.forward,
            lateral: motion.lateral,
            turnRate: motion.turnRate,
            stamina: player.stamina,
            hasBall: sim.ball.holder === player.id,
            style: look.seed,
          }).pose,
          gaitWeight,
          authored,
        );
      const action = visual?.actionContexts[index];
      refineFootballAction(
        authored,
        player.action,
        u,
        p,
        action?.action ? action.usedFoot : getDominantFoot(player.pid),
      );
      refineAthletePosture(authored, {
        time: clock.elapsedTime,
        phase: motion.phase,
        speed,
        seed: look.seed % 97,
        stamina: player.stamina,
        accelerationLean: motion.accelerationLean,
        turnRate: motion.turnRate,
        hasAction: Boolean(player.action),
        defending: sim.possession !== player.side,
      });
      const pose = clampPoseAnatomy(
        poseBlenders[index]!.sample(clampPoseAnatomy(authored), dt, {
          clip,
          action: player.action,
          progress: u,
          instant: paused || previewAt !== undefined,
        }),
      );
      const actionSupport = footballSupportFor(
        player.action,
        u,
        p.hipW,
        action?.action ? action.usedFoot : getDominantFoot(player.pid),
      );
      const shift =
        Math.max(-1, Math.min(1, pose.legRPitch - pose.legLPitch)) *
          0.045 *
          Math.min(1, speed / 4) +
        actionSupport.shiftX;
      const ground = solveGroundContact({
        P: p,
        pose,
        hipShiftX: shift,
        hipRollOffset: shift * 1.2,
        leanX: motion.leanX,
        leanZ: motion.leanZ,
        airborne: airborneFactor(clip, pose.hipY),
        previousRootY: rootY.current[index] ?? 0,
        dt: previewAt !== undefined ? 1 : dt,
        plantedFoot: actionSupport.plantedFoot,
        bodyContact: actionSupport.bodyContact,
      });
      rootY.current[index] = ground.rootY;
      pose.ankleL += ground.ankleLFix;
      pose.ankleR += ground.ankleRFix;
      clampPoseAnatomy(pose);
      position.set(player.x, ground.rootY, player.z);
      scale.set(1, 1, 1);
      quaternion.setFromEuler(euler.set(motion.leanX, motion.yaw, motion.leanZ, "YXZ"));
      root.compose(position, quaternion, scale);
      joint(
        hips,
        root,
        shift,
        p.hipY + pose.hipY,
        0,
        pose.hipPitch,
        pose.hipYaw,
        pose.hipRoll + shift * 1.2,
      );
      draw("hips", index, hips, 0, 0, 0, p.hipW, p.hipH, p.chestD / 0.47);
      const shortsMesh = meshes.hips;
      if (shortsMesh && shortsMesh.count > 0)
        shortsAnimator.update(
          shortsMesh,
          shortsMesh.count - 1,
          pose,
          p.hipW,
          p.hipH,
          p.chestD / 0.47,
        );
      joint(
        spine,
        hips,
        0,
        p.hipH * 0.5,
        0,
        pose.spine,
        -pose.hipYaw * 0.45,
        spineRollForAction(pose.hipRoll, player.action),
      );
      draw(
        "torso",
        index,
        spine,
        0,
        shape.torsoCenterY - p.hipY - p.hipH * 0.5,
        0,
        shape.torsoWidth,
        shape.torsoHeight,
        shape.torsoDepth,
      );
      joint(chest, spine, 0, p.spineLen, 0, pose.chest + p.posture, -pose.hipYaw * 0.6);
      joint(neck, chest, 0, p.chestLen, 0, pose.headPitch, pose.headYaw);
      draw("neck", index, neck, 0, p.neckLen * 0.5, 0, p.neckR * 2, p.neckLen * 1.15, p.neckR * 2);
      joint(head, neck, 0, p.neckLen + p.headR * 0.82, 0);
      draw("head", index, head, 0, 0, 0, p.headW * 2, p.headR * 2, p.headD * 2);
      const hairHeight = look.hairStyle === "afro" ? 1.13 : look.hairStyle === "buzz" ? 0.96 : 1;
      for (const family of LOW_HAIR_FAMILIES) {
        const hairScale =
          look.hairStyle !== "bald" && lowHairFamily(look.hairStyle) === family ? 1 : 0;
        draw(
          family,
          index,
          head,
          0,
          0,
          0,
          p.headW * 2 * hairScale,
          p.headR * 2 * hairHeight * look.hairVolume * hairScale,
          p.headD * 2 * hairScale,
        );
      }
      for (const side of [1, -1] as const) {
        const i = index * 2 + (side === 1 ? 0 : 1);
        const left = side === 1;
        const shoulder = shoulderPose(
          left ? pose.armLPitch : pose.armRPitch,
          left ? pose.armLRoll : pose.armRRoll,
        );
        joint(
          clavicle,
          chest,
          side * p.shoulderW * 0.12,
          p.chestLen * 0.84,
          0,
          shoulder.clavPitch,
          0,
          shoulder.clavRoll,
        );
        joint(
          arm,
          clavicle,
          side * p.shoulderW * 0.4,
          0,
          0,
          shoulder.armPitch,
          shoulder.armYaw,
          shoulder.armRoll,
        );
        draw("arms", i, arm, 0, -p.upperArm * 0.5, 0, p.armR * 2, p.upperArm, p.armR * 2);
        draw(
          "sleeves",
          i,
          arm,
          0,
          -p.upperArm * 0.24,
          0,
          p.armR * 2.44,
          p.upperArm * 0.56,
          p.armR * 2.44,
        );
        joint(fore, arm, 0, -p.upperArm, 0, left ? pose.elbowL : pose.elbowR);
        draw("forearms", i, fore, 0, -p.foreArm * 0.5, 0, p.armR * 2, p.foreArm, p.armR * 2);
        const handR = look.gloves ? p.handR * 1.25 : p.handR;
        draw(
          "hands",
          i,
          fore,
          0,
          -p.foreArm - handR * 0.48,
          handR * 0.1,
          handR * 1.64,
          handR * 2.8,
          handR * 1.2,
        );
        joint(
          thigh,
          hips,
          side * p.hipW * 0.36,
          -p.hipH * 0.4,
          0,
          left ? pose.legLPitch : pose.legRPitch,
          0,
          left ? pose.legLRoll : pose.legRRoll,
        );
        draw("thighs", i, thigh, 0, -p.thigh * 0.5, 0, p.legR * 2, p.thigh, p.legR * 2);
        joint(shin, thigh, 0, -p.thigh, 0, -(left ? pose.kneeL : pose.kneeR));
        draw("shins", i, shin, 0, -p.shin * 0.5, 0, p.legR * 2, p.shin, p.legR * 2);
        const selectedSock =
          look.sockHeight === "low"
            ? "socksLow"
            : look.sockHeight === "high"
              ? "socksHigh"
              : "socksMid";
        for (const sockBatch of SOCK_BATCHES) {
          const sockScale = sockBatch === selectedSock ? 1 : 0;
          draw(
            sockBatch,
            i,
            shin,
            0,
            0,
            0,
            p.legR * 2 * sockScale,
            p.shin * sockScale,
            p.legR * 2 * sockScale,
          );
        }
        joint(ankle, shin, 0, -p.shin, 0, left ? pose.ankleL : pose.ankleR);
        draw("boots", i, ankle, 0, 0, 0, p.footH * 2, p.footH * 2, p.footLen);
      }
      position.set(player.x, 0.012, player.z);
      quaternion.setFromEuler(euler.set(-Math.PI / 2, 0, -motion.yaw));
      scale.set(0.29 + ground.stanceSpread * 0.09, 0.39 + ground.stanceSpread * 0.16, 1);
      part.compose(position, quaternion, scale);
      commit("shadow", index);
    });
    for (const mesh of Object.values(meshes)) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = mesh.count > 0;
    }
  });
  return (
    <group ref={censusRef("playerLow")}>
      {[...BODY_BATCHES, ...LIMB_BATCHES].map((name) => (
        <instancedMesh
          key={name}
          visible={false}
          count={0}
          ref={(mesh) => {
            if (mesh) refs.current[name] = mesh;
            else delete refs.current[name];
          }}
          args={[
            undefined,
            undefined,
            BODY_BATCHES.includes(name as (typeof BODY_BATCHES)[number])
              ? MAX_PLAYERS
              : MAX_PLAYERS * 2,
          ]}
          frustumCulled={false}
          renderOrder={name === "shadow" ? 1 : 0}
        >
          {name === "shadow" ? (
            <meshBasicMaterial color="#050806" transparent opacity={0.23} depthWrite={false} />
          ) : (
            <meshStandardMaterial
              color="white"
              roughness={
                name === "boots"
                  ? 0.35
                  : ["head", "neck", "arms", "forearms", "hands", "thighs", "shins"].includes(name)
                    ? 0.82
                    : 0.85
              }
              envMapIntensity={0.7}
            />
          )}
          {createElement("primitive", { object: geometries[name], attach: "geometry" })}
        </instancedMesh>
      ))}
    </group>
  );
}
