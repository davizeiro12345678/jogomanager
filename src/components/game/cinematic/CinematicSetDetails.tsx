import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { jerseyWeaveNormal } from "@/game/textures/fabric";

function canvasMap(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Real mesh surfaces: shirt silhouette, stitching and numbers stay in 3D. */
export function HangingShirt({ color, number }: { color: string; number: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const outline = [
      [-0.24, -0.48],
      [0.24, -0.48],
      [0.25, 0.17],
      [0.43, 0.04],
      [0.55, 0.27],
      [0.24, 0.43],
      [0.11, 0.46],
      [0.08, 0.34],
      [-0.08, 0.34],
      [-0.11, 0.46],
      [-0.24, 0.43],
      [-0.55, 0.27],
      [-0.43, 0.04],
      [-0.25, 0.17],
    ];
    outline.forEach(([x, y], index) => (index ? shape.lineTo(x!, y!) : shape.moveTo(x!, y!)));
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelSize: 0.014,
      bevelThickness: 0.014,
      bevelSegments: 2,
      steps: 1,
    });
  }, []);
  const ink = useMemo(
    () =>
      canvasMap(128, 128, (ctx) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = "#f5f1e8";
        ctx.font = "bold 76px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(number), 64, 65);
      }),
    [color, number],
  );
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  useEffect(
    () => () => {
      ink?.dispose();
    },
    [ink],
  );
  return (
    <group position={[0, 1.64, 0.34]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color={color}
          roughness={0.88}
          normalMap={jerseyWeaveNormal()}
          normalScale={[0.3, 0.3]}
        />
      </mesh>
      <mesh position={[0, -0.04, 0.05]}>
        <planeGeometry args={[0.28, 0.28]} />
        <meshStandardMaterial map={ink} color={ink ? "white" : color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6, -0.06]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.065, 0.012, 6, 16]} />
        <meshStandardMaterial color="#aab0b7" metalness={0.8} roughness={0.36} />
      </mesh>
    </group>
  );
}

export function TacticsBoard() {
  const map = useMemo(
    () =>
      canvasMap(640, 400, (ctx) => {
        ctx.fillStyle = "#172b2d";
        ctx.fillRect(0, 0, 640, 400);
        ctx.strokeStyle = "#cbdcd4";
        ctx.lineWidth = 3;
        ctx.strokeRect(32, 28, 576, 344);
        ctx.beginPath();
        ctx.moveTo(320, 28);
        ctx.lineTo(320, 372);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(320, 200, 52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeRect(32, 106, 80, 188);
        ctx.strokeRect(528, 106, 80, 188);
        const dots = [
          [74, 200],
          [172, 70],
          [172, 152],
          [172, 248],
          [172, 330],
          [265, 112],
          [265, 200],
          [265, 288],
          [396, 78],
          [435, 200],
          [396, 322],
        ];
        dots.forEach(([x, y], i) => {
          ctx.fillStyle = "#f3ba5a";
          ctx.beginPath();
          ctx.arc(x!, y!, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#151b24";
          ctx.font = "bold 13px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(String(i + 1), x!, y! + 5);
        });
        ctx.strokeStyle = "#78c7c2";
        ctx.setLineDash([10, 7]);
        ctx.beginPath();
        ctx.moveTo(265, 112);
        ctx.lineTo(396, 78);
        ctx.lineTo(435, 200);
        ctx.stroke();
      }),
    [],
  );
  useEffect(() => () => map?.dispose(), [map]);
  return (
    <group position={[4.6, 1.8, -3.92]}>
      <mesh>
        <boxGeometry args={[2.8, 1.84, 0.09]} />
        <meshStandardMaterial color="#8b9299" metalness={0.75} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[2.58, 1.62]} />
        <meshStandardMaterial map={map} color={map ? "white" : "#172b2d"} roughness={0.75} />
      </mesh>
    </group>
  );
}

export function ClubTrophy({
  x,
  y,
  z,
  scale = 1,
}: {
  x: number;
  y: number;
  z: number;
  scale?: number;
}) {
  const profile = useMemo(
    () =>
      [
        [0.08, 0],
        [0.12, 0.03],
        [0.06, 0.06],
        [0.055, 0.2],
        [0.09, 0.23],
        [0.16, 0.32],
        [0.19, 0.5],
        [0.17, 0.55],
      ].map(([r, h]) => new THREE.Vector2(r!, h!)),
    [],
  );
  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh castShadow>
        <latheGeometry args={[profile, 24]} />
        <meshStandardMaterial
          color="#d8b55c"
          metalness={0.9}
          roughness={0.23}
          side={THREE.DoubleSide}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.17, 0.35, 0]} scale={[0.75, 1, 1]}>
          <torusGeometry args={[0.11, 0.017, 6, 16]} />
          <meshStandardMaterial color="#d8b55c" metalness={0.9} roughness={0.23} />
        </mesh>
      ))}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[0.32, 0.08, 0.28]} />
        <meshStandardMaterial color="#141922" roughness={0.65} />
      </mesh>
    </group>
  );
}
