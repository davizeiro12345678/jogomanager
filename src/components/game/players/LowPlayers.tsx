import { useFrame } from "@react-three/fiber";
import { createElement, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { emptyPose, getClip, mixPose, selectClip } from "@/game/animation";
import { gaitPoseAt, locomotionWeight } from "@/game/gait-kinematics";
import { airborneFactor, clampPoseAnatomy, solveGroundContact } from "@/game/ground-contact";
import type { Kit } from "@/game/kits";
import { lowDetailBodyFor, lookFor, proportionsFor } from "@/game/player-model";
import {
  anatomicalLimb,
  anatomicalSection,
  footballBoot,
  type LimbProfile,
} from "@/game/rig-geometry";
import { sculptedHead, sculptedHair } from "@/game/player-sculpt";
import { censusRef } from "@/game/scene-census";
import type { SimView } from "@/game/sim";
import { visualMotionFor } from "@/game/visual-motion";
import { refineFootballAction } from "@/game/football-action";
import { refineAthletePosture, shoulderPose } from "@/game/athlete-posture";
import { visualDataFor } from "@/game/visual-frame-cache";
import { getDominantFoot } from "@/game/visual-context";

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
};
const MAX_PLAYERS = 22;
const BODY_BATCHES = ["torso", "hips", "head", "hair", "neck", "shadow"] as const;
const LIMB_BATCHES = [
  "arms",
  "forearms",
  "hands",
  "sleeves",
  "thighs",
  "shorts",
  "shins",
  "socks",
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
}: LowPlayersProps) {
  const refs = useRef<Partial<Record<Batch, THREE.InstancedMesh>>>({});
  const painted = useRef(false);
  const sampled = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    painted.current = false;
  }, [sim.players]);
  const looks = useMemo(
    () => sim.players.map((p) => lookFor(p.id, p.pos, p.number === 10)),
    [sim.players],
  );
  const proportions = useMemo(() => looks.map(proportionsFor), [looks]);
  const shapes = useMemo(() => proportions.map(lowDetailBodyFor), [proportions]);
  const poses = useMemo(() => sim.players.map(() => emptyPose()), [sim.players]);
  const headGeometry = useMemo(
    () => sculptedHead({ headR: 0.5, headW: 0.5, headD: 0.5 }, 0, false),
    [],
  );
  const hairGeometry = useMemo(
    () =>
      sculptedHair(
        { headR: 0.5, headW: 0.5, headD: 0.5 },
        { ...lookFor("lod-hair", "MF"), hairStyle: "short", hairVolume: 1 },
        false,
      ),
    [],
  );
  const bootGeometry = useMemo(() => footballBoot(1, 0.5, 8), []);
  const gaitBuffer = useRef(emptyPose());
  const limbGeometries = useMemo(() => {
    const profiles: Record<string, LimbProfile> = {
      arms: "upperArm",
      forearms: "forearm",
      thighs: "thigh",
      shins: "calf",
    };
    return Object.fromEntries(
      Object.entries(profiles).map(([batch, profile]) => [
        batch,
        anatomicalLimb(profile, 1, 0.5, 8, true).translate(0, 0.5, 0),
      ]),
    );
  }, []);
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
  const torsoGeometry = useMemo(
    () =>
      anatomicalSection(
        [
          { y: -0.5, width: 0.38, depth: 0.42 },
          { y: -0.15, width: 0.44, depth: 0.47 },
          { y: 0.22, width: 0.5, depth: 0.5 },
          { y: 0.38, width: 0.46, depth: 0.45 },
          { y: 0.5, width: 0.22, depth: 0.25 },
        ],
        10,
      ),
    [],
  );
  const pelvisGeometry = useMemo(
    () =>
      anatomicalSection(
        [
          { y: -0.5, width: 0.43, depth: 0.45 },
          { y: 0, width: 0.5, depth: 0.5 },
          { y: 0.5, width: 0.47, depth: 0.45 },
        ],
        8,
      ),
    [],
  );
  useEffect(
    () => () => {
      torsoGeometry.dispose();
      pelvisGeometry.dispose();
      hairGeometry.dispose();
      headGeometry.dispose();
      bootGeometry.dispose();
      Object.values(limbGeometries).forEach((geometry) => geometry.dispose());
    },
    [torsoGeometry, pelvisGeometry, limbGeometries, hairGeometry, headGeometry, bootGeometry],
  );
  useEffect(() => {
    const color = new THREE.Color();
    sim.players.slice(0, MAX_PLAYERS).forEach((player, index) => {
      const look = looks[index]!;
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
      set("head", index, look.skin);
      set("neck", index, look.skin);
      set("hair", index, look.hairColor);
      for (let side = 0; side < 2; side++) {
        const i = index * 2 + side;
        set("arms", i, look.skin);
        set("forearms", i, look.sleeves === "long" ? kit.base : look.skin);
        set("hands", i, look.gloves ? look.gloveColor : look.skin);
        set("sleeves", i, kit.pattern === "sleeves" ? kit.detail : kit.base);
        set("thighs", i, look.skin);
        set("shorts", i, kit.shorts);
        set("shins", i, look.skin);
        set("socks", i, kit.socks);
        set("boots", i, look.bootColor);
      }
    });
    const count = Math.min(MAX_PLAYERS, sim.players.length);
    for (const [name, mesh] of Object.entries(refs.current)) {
      mesh.count = BODY_BATCHES.includes(name as (typeof BODY_BATCHES)[number]) ? count : count * 2;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
    }
  }, [sim.players, looks, homeKit, awayKit, homeGkKit, awayGkKit]);
  useFrame(({ clock }, rawDt) => {
    // A model mounted while paused still needs its first set of matrices.
    if (paused && painted.current && sampled.current === previewAt) return;
    sampled.current = previewAt;
    painted.current = true;
    const dt = Math.min(rawDt, 0.1);
    const meshes = refs.current;
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
      quaternion.setFromEuler(euler.set(pitch, yaw, roll, "YXZ"));
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
      position.set(x, y, z);
      quaternion.identity();
      scale.set(sx, sy, sz);
      local.compose(position, quaternion, scale);
      part.multiplyMatrices(parent, local);
      meshes[batch]?.setMatrixAt(i, part);
    };
    sim.players.slice(0, MAX_PLAYERS).forEach((player, index) => {
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
      if (excluded?.has(player.id) || player.sentOff) {
        part.makeScale(0, 0, 0);
        for (const name of BODY_BATCHES) meshes[name]?.setMatrixAt(index, part);
        for (const name of LIMB_BATCHES) {
          meshes[name]?.setMatrixAt(index * 2, part);
          meshes[name]?.setMatrixAt(index * 2 + 1, part);
        }
        return;
      }
      const speed = motion.speed;
      const clip = selectClip({
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
        player.action && player.actionDur > 0
          ? Math.max(0, Math.min(1, 1 - player.actionT / player.actionDur))
          : (clock.elapsedTime % 1.4) / 1.4;
      const authored = getClip(clip)({
        t: clock.elapsedTime,
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
        mixPose(
          poses[index]!,
          clampPoseAnatomy(authored),
          previewAt !== undefined ? 1 : 1 - Math.exp(-(player.action ? 27 : 18) * dt),
          poses[index],
        ),
      );
      const shift =
        Math.max(-1, Math.min(1, pose.legRPitch - pose.legLPitch)) * 0.045 * Math.min(1, speed / 4);
      const ground = solveGroundContact({
        P: p,
        pose,
        hipShiftX: shift,
        hipRollOffset: shift * 1.2,
        leanX: motion.leanX,
        leanZ: motion.leanZ,
        airborne: airborneFactor(clip, pose.hipY),
        previousRootY: rootY.current[index] ?? 0,
        dt,
      });
      rootY.current[index] = ground.rootY;
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
      draw(
        "hips",
        index,
        hips,
        0,
        -p.hipH * 0.12,
        0,
        shape.pelvisWidth,
        shape.pelvisHeight,
        shape.pelvisDepth,
      );
      joint(spine, hips, 0, p.hipH * 0.5, 0, pose.spine, -pose.hipYaw * 0.45, -pose.hipRoll * 0.35);
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
      const hairHeight = look.hairStyle === "afro" ? 1.25 : look.hairStyle === "curly" ? 1.12 : 1;
      const hairScale = look.hairStyle === "bald" ? 0 : 1;
      draw(
        "hair",
        index,
        head,
        0,
        0,
        0,
        p.headW * 2 * hairScale,
        p.headR * 2 * hairHeight * look.hairVolume * hairScale,
        p.headD * 2 * hairScale,
      );
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
          side * p.hipW * 0.46,
          -p.hipH * 0.4,
          0,
          left ? pose.legLPitch : pose.legRPitch,
          0,
          left ? pose.legLRoll : pose.legRRoll,
        );
        draw("thighs", i, thigh, 0, -p.thigh * 0.5, 0, p.legR * 2, p.thigh, p.legR * 2);
        draw("shorts", i, thigh, 0, -p.thigh * 0.26, 0, p.legR * 2.6, p.thigh * 0.5, p.legR * 2.6);
        joint(shin, thigh, 0, -p.thigh, 0, -(left ? pose.kneeL : pose.kneeR));
        draw("shins", i, shin, 0, -p.shin * 0.5, 0, p.legR * 2, p.shin, p.legR * 2);
        const sockLength =
          look.sockHeight === "low" ? 0.35 : look.sockHeight === "high" ? 0.75 : 0.6;
        draw(
          "socks",
          i,
          shin,
          0,
          -p.shin * (1 - sockLength / 2),
          0,
          p.legR * 1.88,
          p.shin * sockLength,
          p.legR * 1.88,
        );
        joint(
          ankle,
          shin,
          0,
          -p.shin,
          0,
          left ? pose.ankleL + ground.ankleLFix : pose.ankleR + ground.ankleRFix,
        );
        draw("boots", i, ankle, 0, 0, 0, p.footH * 2, p.footH * 2, p.footLen);
      }
      position.set(player.x, 0.012, player.z);
      quaternion.setFromEuler(euler.set(-Math.PI / 2, 0, -motion.yaw));
      scale.set(0.29 + ground.stanceSpread * 0.09, 0.39 + ground.stanceSpread * 0.16, 1);
      part.compose(position, quaternion, scale);
      meshes.shadow?.setMatrixAt(index, part);
    });
    for (const mesh of Object.values(meshes)) mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={censusRef("playerLow")}>
      {[...BODY_BATCHES, ...LIMB_BATCHES].map((name) => (
        <instancedMesh
          key={name}
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
          {name === "torso" ? (
            createElement("primitive", { object: torsoGeometry, attach: "geometry" })
          ) : name === "hips" ? (
            createElement("primitive", { object: pelvisGeometry, attach: "geometry" })
          ) : name === "head" ? (
            createElement("primitive", { object: headGeometry, attach: "geometry" })
          ) : name === "boots" ? (
            createElement("primitive", { object: bootGeometry, attach: "geometry" })
          ) : name === "hands" ? (
            <sphereGeometry args={[0.5, 10, 8]} />
          ) : name === "hair" ? (
            createElement("primitive", { object: hairGeometry, attach: "geometry" })
          ) : name === "neck" ? (
            <cylinderGeometry args={[0.4, 0.5, 1, 8]} />
          ) : name === "shadow" ? (
            <circleGeometry args={[1, 16]} />
          ) : limbGeometries[name] ? (
            createElement("primitive", { object: limbGeometries[name], attach: "geometry" })
          ) : (
            <cylinderGeometry args={[0.46, 0.5, 1, 8, 2]} />
          )}
        </instancedMesh>
      ))}
    </group>
  );
}
