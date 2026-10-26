import { StaticBatch } from "@/components/game/stadium/StaticBatch";

import { useFrame } from "@react-three/fiber";

import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { adTexture, retainAdTexture } from "@/components/game/stadium/textures/ads";

import { lightGlowTexture } from "@/components/game/stadium/textures/light-glow";

import { FIELD_X, FIELD_Z } from "@/game/sim-rules";
import { type SimView } from "@/game/sim-types";

import { type TimeOfDay } from "@/game/matchday";

import { useVisual } from "@/game/visual-settings";

import { type Quality } from "./shared";
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

  useFrame(({ clock }, delta) => {
    if (texA) texA.offset.x = (texA.offset.x + delta * 0.05) % 1;
    if (texB) texB.offset.x = (texB.offset.x - delta * 0.05 + 1) % 1;
    // leve cintilar do painel
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

/** Telão atualizado no máximo cinco vezes por segundo, sem worker de fontes. */
export function Scoreboard({
  sim,
  replay,
  goalPulse,
}: {
  sim: SimView;
  replay: boolean;
  goalPulse: React.MutableRefObject<number>;
}) {
  const board = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 320;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return { canvas, texture, last: "" };
  }, []);
  const tick = useRef(0);
  useFrame(({ clock }) => {
    if (!board || ++tick.current % 12 !== 0) return;
    const possessionTotal = sim.stats.home.possessionTicks + sim.stats.away.possessionTicks;
    const homePossession =
      possessionTotal > 0
        ? Math.round((sim.stats.home.possessionTicks / possessionTotal) * 100)
        : 50;
    // flash de gol: alterna o fundo 4x por segundo enquanto o pulso está alto
    const celebrating = goalPulse.current > 0.45;
    const flash = celebrating ? Math.floor(clock.elapsedTime * 4) % 2 : 0;
    const key = `${sim.home.short}|${sim.stats.home.goals}|${sim.stats.away.goals}|${sim.away.short}|${sim.minute()}|${replay}|${homePossession}|${sim.stats.home.shots}|${sim.stats.away.shots}|${flash}`;
    if (board.last === key) return;
    board.last = key;
    const ctx = board.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, board.canvas.width, board.canvas.height);
    ctx.fillStyle = celebrating ? (flash ? "#7a1016" : "#3d080d") : replay ? "#5f151b" : "#07140d";
    ctx.fillRect(0, 0, board.canvas.width, board.canvas.height);
    ctx.fillStyle = "#25e77f";
    ctx.fillRect(0, 0, board.canvas.width, 12);
    ctx.fillRect(0, board.canvas.height - 12, board.canvas.width, 12);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "700 30px sans-serif";
    ctx.fillStyle = replay ? "#ffb3ba" : "#39f18b";
    ctx.fillText(replay ? "REPLAY" : "AO VIVO", 42, 48);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9eb8aa";
    ctx.font = "600 26px sans-serif";
    ctx.fillText(`${sim.minute()}'`, 982, 48);
    ctx.textAlign = "center";
    ctx.font = "700 92px sans-serif";
    ctx.fillStyle = "#eafff2";
    ctx.fillText(
      `${sim.home.short}  ${sim.stats.home.goals} — ${sim.stats.away.goals}  ${sim.away.short}`,
      512,
      132,
    );
    ctx.font = "700 30px sans-serif";
    if (celebrating) {
      ctx.fillStyle = flash ? "#ffffff" : "#ffd76a";
      ctx.font = "800 44px sans-serif";
      ctx.fillText("★ GOOOL! ★", 512, 232);
      ctx.font = "700 30px sans-serif";
    } else {
      ctx.fillStyle = replay ? "#ffd2d5" : "#ffd76a";
      ctx.fillText(
        `${homePossession}% POSSE  ·  ${sim.stats.home.shots}–${sim.stats.away.shots} CHUTES`,
        512,
        232,
      );
    }
    ctx.fillStyle = "#2de67e";
    ctx.fillRect(42, 272, 940 * (homePossession / 100), 12);
    ctx.fillStyle = "#4c6a79";
    ctx.fillRect(42 + 940 * (homePossession / 100), 272, 940 * (1 - homePossession / 100), 12);
    board.texture.needsUpdate = true;
  });
  useEffect(() => () => board?.texture.dispose(), [board]);
  return (
    <group position={[0, 22, -(FIELD_Z + 26)]}>
      <mesh>
        <boxGeometry args={[30, 11, 1]} />
        <meshStandardMaterial color="#0b0e12" roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.55]}>
        <planeGeometry args={[28.6, 9.6]} />
        <meshStandardMaterial color="#04070b" emissive="#0a1a12" emissiveIntensity={0.5} />
      </mesh>
      {/* moldura luminosa do painel */}
      <mesh position={[0, 4.9, 0.56]}>
        <boxGeometry args={[29.2, 0.22, 0.05]} />
        <meshBasicMaterial color="#1de07a" toneMapped={false} />
      </mesh>
      <mesh position={[0, -4.9, 0.56]}>
        <boxGeometry args={[29.2, 0.22, 0.05]} />
        <meshBasicMaterial color="#1de07a" toneMapped={false} />
      </mesh>
      {/* O placar DOM concentra os dados. O painel físico continua emissivo,
          sem gerar atlas de fonte/worker dentro do caminho crítico da partida. */}
      {board ? (
        <mesh position={[0, 0, 0.62]}>
          <planeGeometry args={[28.2, 8.9]} />
          <meshBasicMaterial map={board.texture} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function Floodlights({ time, quality }: { time: TimeOfDay; quality: Quality }) {
  const on = time !== "dia";
  const lampColor = time === "entardecer" ? "#ffe2c7" : "#e8f2ff";
  const haloColor = time === "entardecer" ? "#ffd1aa" : "#cfe3ff";
  const spots: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const lamps = [-2.6, -0.9, 0.9, 2.6];
  return (
    <StaticBatch signature={`floodlights:${time}:${quality}`}>
      {spots.map(([sx, sz], i) => {
        const px = sx * (FIELD_X + 20);
        const pz = sz * (FIELD_Z + 22);
        const dist = Math.hypot(px, pz);
        return (
          <group key={i} position={[px, 0, pz]}>
            {/* mastro treliçado */}
            <mesh position={[0, 14, 0]} castShadow>
              <cylinderGeometry args={[0.5, 0.9, 28, 8]} />
              <meshStandardMaterial color="#252c33" roughness={0.85} metalness={0.35} />
            </mesh>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} position={[0, 6 + k * 6, 0]}>
                <torusGeometry args={[0.85, 0.07, 4, 10]} />
                <meshStandardMaterial color="#39424b" roughness={0.8} metalness={0.4} />
              </mesh>
            ))}
            {/* rack com lâmpadas individuais */}
            <mesh position={[0, 28.5, 0]}>
              <boxGeometry args={[8.6, 3.6, 0.6]} />
              <meshStandardMaterial color="#39424b" roughness={0.8} metalness={0.4} />
            </mesh>
            {lamps.map((lx) =>
              [0.85, -0.85].map((ly) => (
                <mesh key={`${lx}${ly}`} position={[lx, 28.5 + ly, 0.45]}>
                  <boxGeometry args={[1.5, 1.3, 0.3]} />
                  <meshStandardMaterial
                    color="#f5f8ff"
                    emissive={on ? lampColor : "#2b3138"}
                    emissiveIntensity={on ? (time === "entardecer" ? 2.8 : 3.6) : 0}
                    toneMapped={false}
                  />
                </mesh>
              )),
            )}
            {on && (
              <>
                {/* halo volumétrico curto, apenas em volta do rack */}
                {quality === "alta" && (
                  <mesh position={[0, 26, 0]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[5.5, 9, 14, 1, true]} />
                    <meshBasicMaterial
                      color={haloColor}
                      transparent
                      opacity={0.05}
                      depthWrite={false}
                      side={THREE.DoubleSide}
                      blending={THREE.AdditiveBlending}
                      toneMapped={false}
                    />
                  </mesh>
                )}

                <sprite position={[0, 28.5, 0]} scale={[30, 30, 1]}>
                  <spriteMaterial
                    map={lightGlowTexture()}
                    color={haloColor}
                    opacity={time === "entardecer" ? 0.14 : 0.18}
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    toneMapped={false}
                  />
                </sprite>
                {quality === "alta" && (
                  <pointLight
                    position={[0, 28, 0]}
                    intensity={time === "entardecer" ? 1250 : 1700}
                    distance={230}
                    color={lampColor}
                  />
                )}
              </>
            )}
          </group>
        );
      })}
      {/* reflexo dos refletores no gramado úmido: discreto, colado nos cantos */}
      {on &&
        quality === "alta" &&
        spots.map(([sx, sz], i) => (
          <mesh
            key={`r${i}`}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[sx * (FIELD_X * 0.86), 0.02, sz * (FIELD_Z * 0.86)]}
          >
            <circleGeometry args={[10, 20]} />
            <meshBasicMaterial
              color="#9fc4ff"
              transparent
              opacity={0.02}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
    </StaticBatch>
  );
}

/** Concreto compartilhado por toda a estrutura (um material só, muitas peças). */
