import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_Z } from "@/game/sim-rules";
import type { SimView } from "@/game/sim-contracts";

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
