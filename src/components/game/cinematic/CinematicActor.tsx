import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Speaker } from "@/content/cutscenes";
import { cinematicActorPose, cinematicLook } from "@/game/cinematic-actor";
import { cinematicDetail } from "@/game/cinematic-performance";
import { emptyPose, mixPose } from "@/game/animation-core";
import { proportionsFor } from "@/game/player-model";
import { playerMaterials, retainPlayerMaterials } from "@/game/player-materials";
import { buildRigSkin } from "@/game/rig-skin";
import { shoulderPose } from "@/game/athlete-posture";
import { applyHandPose } from "@/game/player-hands";
import type { Kit } from "@/game/kits";
import { useCinematicFrame, useCinematicRuntime } from "./cinematic-runtime";

export function CinematicActor({
  x,
  z,
  rot = 0,
  color,
  shorts = "#12181c",
  seed = 1,
  pose = "stand",
  scale = 1,
  acting = false,
  role,
}: {
  x: number;
  z: number;
  rot?: number;
  color: string;
  shorts?: string;
  seed?: number;
  pose?: "stand" | "sit" | "walk";
  scale?: number;
  acting?: boolean;
  role?: Speaker | undefined;
}) {
  const runtime = useCinematicRuntime();
  const staff = Boolean(role && role !== "captain" && role !== "fan");
  const identity =
    role === "manager" ? runtime.look : role ? runtime.cast?.[role]?.look : undefined;
  const look = useMemo(
    () => ({
      ...cinematicLook(seed, identity),
      sleeves: staff ? ("long" as const) : ("short" as const),
      collar: role ? ("v" as const) : ("crew" as const),
      ...(staff ? { bootColor: "#1b2029", bootAccent: "#69717c" } : {}),
    }),
    [seed, identity, role, staff],
  );
  const p = useMemo(() => proportionsFor(look), [look]);
  const kit = useMemo<Kit>(
    () => ({ base: color, shorts, socks: shorts, detail: color, pattern: "solid" }),
    [color, shorts],
  );
  const detail = cinematicDetail(runtime.quality, Boolean(role));
  const mats = useMemo(
    () => playerMaterials(look, kit, null, detail.high ? "alta" : "media"),
    [look, kit, detail.high],
  );
  useLayoutEffect(() => retainPlayerMaterials(mats), [mats]);
  const skin = useMemo(
    () =>
      buildRigSkin(
        {
          P: p,
          look,
          mats,
          hi: detail.high,
          segs: { radial: detail.radial, cap: 4 },
          jerseyInk: color,
          handR: p.handR,
          handMat: mats.skin,
          trousers: staff,
        },
        [0, 0, 0],
      ),
    [p, look, mats, detail.high, detail.radial, color, staff],
  );
  const group = useRef<THREE.Group>(null);
  const target = useRef(emptyPose());
  const current = useRef(emptyPose());
  const first = useRef(true);
  useLayoutEffect(() => {
    first.current = true;
  }, [acting, pose, skin]);
  const meshes = useMemo(
    () =>
      skin.groups.map((part) => {
        const mesh = new THREE.SkinnedMesh(part.geometry, part.material);
        mesh.skeleton = skin.skeleton;
        mesh.bindMatrix.copy(skin.bindMatrix);
        mesh.bindMatrixInverse.copy(skin.bindMatrix).invert();
        mesh.frustumCulled = false;
        mesh.castShadow =
          runtime.quality !== "baixa" && part.castShadow && part.lod === "core" && Boolean(role);
        return mesh;
      }),
    [skin, runtime.quality, role],
  );
  useEffect(() => () => skin.dispose(), [skin]);
  useCinematicFrame((time, dt) => {
    cinematicActorPose(time, seed, pose, acting, p, target.current);
    mixPose(
      current.current,
      target.current,
      first.current || runtime.reduced ? 1 : 1 - Math.exp(-12 * dt),
      current.current,
    );
    const c = current.current,
      b = skin.boneOf;
    b.hips.position.y = p.hipY + c.hipY;
    b.hips.rotation.set(c.hipPitch, c.hipYaw, c.hipRoll);
    b.spine.rotation.set(c.spine, -c.hipYaw * 0.45, -c.hipRoll * 0.35);
    b.chest.rotation.x = c.chest + p.posture;
    b.neck.rotation.set(c.headPitch, c.headYaw, 0);
    for (const left of [true, false]) {
      const s = left ? "L" : "R";
      const shoulder = shoulderPose(
        left ? c.armLPitch : c.armRPitch,
        left ? c.armLRoll : c.armRRoll,
      );
      b[`clav${s}`].rotation.set(shoulder.clavPitch, 0, shoulder.clavRoll);
      b[`arm${s}`].rotation.set(shoulder.armPitch, shoulder.armYaw, shoulder.armRoll);
      b[`fore${s}`].rotation.x = left ? c.elbowL : c.elbowR;
      b[`leg${s}`].rotation.set(
        left ? c.legLPitch : c.legRPitch,
        0,
        left ? c.legLRoll : c.legRRoll,
      );
      b[`knee${s}`].rotation.x = -(left ? c.kneeL : c.kneeR);
      b[`ankle${s}`].rotation.x = left ? c.ankleL : c.ankleR;
    }
    if (detail.high) {
      applyHandPose(
        b,
        { grip: acting ? 0.14 : 0.22, spread: acting ? 0.07 : 0.02, wrist: 0 },
        first.current ? 0.25 : dt,
      );
      b.jaw.rotation.x = acting ? 0.02 + Math.abs(Math.sin(time * 7.4 + seed)) * 0.07 : 0;
      const blink = time % (4.1 + (seed % 3) * 0.2);
      b.blink.scale.y = blink < 0.16 ? 0.08 + Math.sin((blink / 0.16) * Math.PI) * 0.9 : 0.08;
    }
    first.current = false;
    if (group.current) group.current.position.y = pose === "walk" ? Math.max(0, c.hipY * 0.4) : 0;
  });
  return (
    <group ref={group} position={[x, 0, z]} rotation-y={rot} scale={scale} dispose={null}>
      <primitive object={skin.root} />
      {meshes.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} />
      ))}
    </group>
  );
}
