import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCinematicFrame } from "./cinematic-runtime";

function RoomSign({ medical, primary }: { medical: boolean; primary: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = medical ? "#dce8e8" : "#152e3e";
    ctx.fillRect(0, 0, 768, 384);
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, 12, 384);
    ctx.fillStyle = medical ? "#355c65" : "#99b9c8";
    ctx.font = "600 28px sans-serif";
    ctx.fillText("JOGOMANAGER", 44, 66);
    ctx.fillStyle = medical ? "#25434a" : "#f1f2e8";
    ctx.font = "700 54px sans-serif";
    ctx.fillText(medical ? "CUIDAR PARA" : "PREPARAÇÃO", 44, 151);
    ctx.fillText(medical ? "VOLTAR MELHOR" : "É TODO DIA", 44, 215);
    ctx.fillStyle = medical ? "#64858c" : "#c7ac73";
    ctx.font = "500 22px sans-serif";
    ctx.fillText(
      medical ? "SAÚDE • RECUPERAÇÃO • CONFIANÇA" : "FORÇA • EQUILÍBRIO • CONSTÂNCIA",
      44,
      309,
    );
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [medical, primary]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return (
    <mesh position={[medical ? 4.85 : -3.9, 2.7, -4.25]}>
      <planeGeometry args={[2.5, 1.25]} />
      <meshStandardMaterial map={texture} roughness={0.86} />
    </mesh>
  );
}

function RecoveryTrace() {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(80 * 3), 3),
    );
    return new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: "#90e5b7", toneMapped: false }),
    );
  }, []);
  const initialized = useRef(false);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );
  useCinematicFrame((time, dt) => {
    if (initialized.current && dt === 0) return;
    initialized.current = true;
    const positions = line.geometry.getAttribute("position");
    for (let i = 0; i < 80; i++) {
      const phase = (i / 80 + time * 0.35) % 1;
      const pulse =
        Math.exp(-(((phase - 0.5) / 0.025) ** 2)) * 0.16 -
        Math.exp(-(((phase - 0.455) / 0.02) ** 2)) * 0.04 -
        Math.exp(-(((phase - 0.545) / 0.02) ** 2)) * 0.06;
      positions.setXYZ(i, -0.38 + (i / 79) * 0.76, 0.018 * Math.sin(phase * 25) + pulse, 0);
    }
    positions.needsUpdate = true;
  });
  return (
    <group position={[3.2, 1.23, -2.295]} userData={{ cinematicDynamic: true }}>
      <primitive object={line} />
    </group>
  );
}

/** Recognizable room dressing remains inside the existing static batch. */
export function CinematicRoomDetails({ medical, primary }: { medical: boolean; primary: string }) {
  return (
    <group>
      <RoomSign medical={medical} primary={primary} />
      <mesh position={[0, 0.1, -4.25]}>
        <boxGeometry args={[13.8, 0.2, 0.06]} />
        <meshStandardMaterial color="#728c97" roughness={0.55} />
      </mesh>
      {medical ? (
        <>
          <RecoveryTrace />
          <group position={[-4.2, 0, -2.4]}>
            <mesh position={[0, 0.89, 0]}>
              <boxGeometry args={[1.8, 0.08, 0.8]} />
              <meshStandardMaterial color="#dfe7e5" roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[1.6, 0.8, 0.7]} />
              <meshStandardMaterial color="#afc4ca" roughness={0.84} />
            </mesh>
            <mesh position={[0.45, 0.96, 0]}>
              <boxGeometry args={[0.38, 0.08, 0.22]} />
              <meshStandardMaterial color="#f5efe1" roughness={0.9} />
            </mesh>
            {[-0.6, 0.2].map((x) => (
              <mesh key={x} position={[x, 1.02, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.2, 8]} />
                <meshStandardMaterial color="#74a3a8" roughness={0.7} />
              </mesh>
            ))}
          </group>
          <mesh position={[-0.92, 0.57, 0.6]}>
            <boxGeometry args={[0.45, 0.15, 0.62]} />
            <meshStandardMaterial color="#edf1e9" roughness={0.94} />
          </mesh>
          <mesh position={[5.65, 2.2, -1.8]}>
            <boxGeometry args={[0.06, 2.6, 2.2]} />
            <meshStandardMaterial color="#bed4d7" roughness={0.94} />
          </mesh>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh key={i} position={[5.6, 2.2, -2.85 + i * 0.3]}>
              <boxGeometry args={[0.04, 2.55, 0.075]} />
              <meshStandardMaterial color="#97b6bd" roughness={0.98} />
            </mesh>
          ))}
        </>
      ) : (
        <>
          <mesh position={[-0.85, 0.56, 0.55]}>
            <boxGeometry args={[0.36, 0.04, 0.58]} />
            <meshStandardMaterial color="#bec9c5" roughness={0.97} />
          </mesh>
          <group position={[4.3, 0, 0]}>
            {[-0.5, 0.5].map((z) => (
              <mesh key={z} position={[0, 0.36, z]} rotation-x={Math.PI / 2}>
                <torusGeometry args={[0.33, 0.035, 6, 18]} />
                <meshStandardMaterial color="#1a2934" roughness={0.7} />
              </mesh>
            ))}
            <mesh position={[0, 0.58, 0]} rotation-x={-0.5}>
              <cylinderGeometry args={[0.035, 0.035, 0.9, 8]} />
              <meshStandardMaterial color="#a5b4bb" metalness={0.6} roughness={0.38} />
            </mesh>
            <mesh position={[0, 0.99, -0.15]}>
              <boxGeometry args={[0.3, 0.07, 0.22]} />
              <meshStandardMaterial color="#1b2b36" roughness={0.88} />
            </mesh>
            <mesh position={[0, 1.15, 0.5]}>
              <boxGeometry args={[0.6, 0.05, 0.12]} />
              <meshStandardMaterial color="#718a96" metalness={0.5} roughness={0.4} />
            </mesh>
          </group>
          <group position={[-4.4, 0, -0.15]}>
            <mesh position={[0, 0.44, 0]}>
              <boxGeometry args={[1.7, 0.14, 0.62]} />
              <meshStandardMaterial color="#233a47" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.22, 0]}>
              <boxGeometry args={[1.4, 0.44, 0.12]} />
              <meshStandardMaterial color="#8da1ac" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0.6, 0.66, 0]}>
              <cylinderGeometry args={[0.045, 0.045, 0.3, 10]} />
              <meshStandardMaterial color="#89bdd1" roughness={0.35} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}
