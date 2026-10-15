import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { useVisual } from "@/game/visual-settings";
import { adTexture, retainAdTexture } from "./textures/ads";

export function AdBoards({ homeColor, awayColor }: { homeColor: string; awayColor: string }) {
  const sponsors = useVisual().sponsors;
  const key = sponsors.join(",");
  const tex = useMemo(
    () => adTexture(homeColor, awayColor, key ? key.split(",") : []),
    [homeColor, awayColor, key],
  );
  const matA = useRef<THREE.MeshStandardMaterial>(null);
  useEffect(() => retainAdTexture(tex), [tex]);
  const matB = useRef<THREE.MeshStandardMaterial>(null);
  const len = (FIELD_X + 8) * 2;

  const texA = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(3, 1);
    return t;
  }, [tex]);
  const texB = useMemo(() => {
    if (!tex) return null;
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(3, 1);
    t.offset.x = 0.5;
    return t;
  }, [tex]);
  useEffect(
    () => () => {
      texA?.dispose();
      texB?.dispose();
    },
    [texA, texB],
  );

  const flickerClock = useRef(0);
  useFrame(({ clock }, delta) => {
    if (texA) texA.offset.x = (texA.offset.x + delta * 0.05) % 1;
    if (texB) texB.offset.x = (texB.offset.x - delta * 0.05 + 1) % 1;
    // The LED scroll remains smooth; emissive uniform changes only at 10 Hz.
    // This removes redundant material writes on 60/120 FPS devices.
    flickerClock.current += delta;
    if (flickerClock.current < 0.1) return;
    flickerClock.current %= 0.1;
    const flick = 0.53 + Math.sin(clock.elapsedTime * 2.4) * 0.012;
    if (matA.current) matA.current.emissiveIntensity = flick;
    if (matB.current) matB.current.emissiveIntensity = flick;
  });

  if (!texA || !texB) return null;

  return (
    <group>
      {[
        { z: -(FIELD_Z + 5), rot: 0, m: matA, t: texA },
        { z: FIELD_Z + 5, rot: Math.PI, m: matB, t: texB },
      ].map((s, i) => (
        <mesh key={i} position={[0, 0.62, s.z]} rotation={[0, s.rot, 0]}>
          <boxGeometry args={[len, 1.24, 0.22]} />
          <meshStandardMaterial
            ref={s.m}
            map={s.t}
            emissiveMap={s.t}
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.5}
            roughness={0.35}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
