import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Cutscene } from "@/content/cutscenes";
import type { QualityLevel } from "@/game/device";
import { jerseyWeaveNormal } from "@/game/textures/fabric";

type Business = NonNullable<Cutscene["business"]>;

function businessArtwork(
  business: Business,
  primary: string,
  secondary: string,
  language: string,
  quality: QualityLevel,
) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = quality === "baixa" ? 512 : 1024;
  canvas.height = canvas.width / 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(canvas.width / 1024, canvas.height / 512);
  const background = ctx.createLinearGradient(0, 0, 1024, 512);
  background.addColorStop(0, "#152b3a");
  background.addColorStop(1, "#0e1e2a");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 1024, 12);
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 500, 1024, 12);
  // Restrained printed frame gives the event board depth without more meshes.
  ctx.strokeStyle = "#50626c";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, 960, 448);
  ctx.fillStyle = secondary;
  ctx.fillRect(430, 76, 164, 3);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f0df";
  const label = (text: string, y: number, size: number) => {
    ctx.font = `600 ${size}px sans-serif`;
    while (ctx.measureText(text).width > 920 && size > 18) ctx.font = `600 ${--size}px sans-serif`;
    let visible = text;
    while (ctx.measureText(visible).width > 920 && visible.length > 1)
      visible = visible.slice(0, -2) + "…";
    ctx.fillText(visible, 512, y);
  };
  label(business.clubName, 154, 46);
  label(business.subjectName, 273, 66);
  const en = !language.startsWith("pt");
  label(
    business.kind === "sponsor"
      ? business.stage === "negotiation"
        ? en
          ? "SPONSORSHIP PROPOSAL"
          : "PROPOSTA DE PATROCÍNIO"
        : en
          ? "OFFICIAL PARTNERSHIP"
          : "PARCERIA OFICIAL"
      : business.stage === "negotiation"
        ? en
          ? "PLAYER RECRUITMENT"
          : "NEGOCIAÇÃO DE JOGADOR"
        : en
          ? "WELCOME TO THE CLUB"
          : "BEM-VINDO AO CLUBE",
    379,
    30,
  );
  ctx.fillStyle = "#b1c0c6";
  label(en ? "FOOTBALL · COMMITMENT · FUTURE" : "FUTEBOL · COMPROMISSO · FUTURO", 443, 18);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;
  return texture;
}

/** One small printed sheet replaces separate line meshes. No financial values
 * are invented here: the career host remains the authority for deal terms. */
function documentArtwork(
  business: Business,
  primary: string,
  language: string,
  quality: QualityLevel,
) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = quality === "baixa" ? 128 : 256;
  canvas.height = canvas.width * 1.5;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(canvas.width / 256, canvas.height / 384);
  ctx.fillStyle = "#f3f0e6";
  ctx.fillRect(0, 0, 256, 384);
  ctx.fillStyle = primary;
  ctx.fillRect(22, 22, 212, 5);
  const en = !language.startsWith("pt");
  const label = (value: string, y: number, size: number, weight = 600) => {
    ctx.font = `${weight} ${size}px sans-serif`;
    while (ctx.measureText(value).width > 212 && size > 8)
      ctx.font = `${weight} ${--size}px sans-serif`;
    let visible = value;
    while (ctx.measureText(visible).width > 212 && visible.length > 1)
      visible = visible.slice(0, -2) + "…";
    ctx.fillText(visible, 22, y);
  };
  ctx.fillStyle = "#293d48";
  label(business.clubName, 50, 15);
  label(
    business.kind === "transfer"
      ? en
        ? "PLAYER AGREEMENT"
        : "ACORDO DE CONTRATAÇÃO"
      : en
        ? "PARTNERSHIP AGREEMENT"
        : "ACORDO DE PATROCÍNIO",
    85,
    11,
  );
  label(business.subjectName, 110, 14);
  ctx.fillStyle = "#687578";
  label(en ? "TERMS · PROJECT · INTEGRATION" : "TERMOS · PROJETO · INTEGRAÇÃO", 139, 8, 500);
  for (let paragraph = 0; paragraph < 3; paragraph++) {
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = row === 0 ? "#a0a9a4" : "#bdc3bb";
      ctx.fillRect(22, 163 + paragraph * 38 + row * 8, row === 2 ? 142 : 208, 2);
    }
  }
  ctx.fillStyle = "#293d48";
  label(
    business.stage === "negotiation"
      ? en
        ? "PROPOSAL UNDER REVIEW"
        : "PROPOSTA EM ANÁLISE"
      : en
        ? "TERMS CHECKED"
        : "TERMOS CONFERIDOS",
    292,
    9,
  );
  ctx.fillStyle = "#a6aea7";
  ctx.fillRect(22, 329, 94, 1);
  ctx.fillRect(140, 329, 94, 1);
  ctx.fillStyle = "#65716f";
  label(en ? "CLUB / REPRESENTATIVE" : "CLUBE / REPRESENTANTE", 346, 8, 500);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = quality === "baixa" ? 1 : 2;
  return texture;
}

/** Opaque garment with a real neckline, sleeve and hem silhouette. The display
 * is part of the static set, so it never creates another animated actor. */
function DisplayShirt({
  primary,
  secondary,
  quality,
}: {
  primary: string;
  secondary: string;
  quality: QualityLevel;
}) {
  const garment = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.29, -0.48);
    shape.quadraticCurveTo(0, -0.52, 0.29, -0.48);
    shape.lineTo(0.3, 0.15);
    shape.lineTo(0.46, 0.06);
    shape.lineTo(0.58, 0.29);
    shape.lineTo(0.29, 0.48);
    shape.lineTo(0.14, 0.5);
    shape.quadraticCurveTo(0, 0.32, -0.14, 0.5);
    shape.lineTo(-0.29, 0.48);
    shape.lineTo(-0.58, 0.29);
    shape.lineTo(-0.46, 0.06);
    shape.lineTo(-0.3, 0.15);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.035,
      steps: 1,
      curveSegments: quality === "alta" ? 8 : 4,
      bevelEnabled: quality !== "baixa",
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 1,
    });
  }, [quality]);
  useEffect(() => () => garment.dispose(), [garment]);
  return (
    <group>
      <mesh geometry={garment}>
        <meshStandardMaterial
          color={primary}
          normalMap={quality === "baixa" ? null : jerseyWeaveNormal()}
          normalScale={quality === "baixa" ? [1, 1] : [0.22, 0.22]}
          roughness={0.96}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.435, 0.29, 0.048]} rotation-z={side * -0.56}>
          <boxGeometry args={[0.27, 0.027, 0.008]} />
          <meshStandardMaterial color={secondary} roughness={0.96} />
        </mesh>
      ))}
      <mesh position={[0.15, 0.21, 0.051]} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.072, 0.072, 0.009]} />
        <meshStandardMaterial color={secondary} roughness={0.96} />
      </mesh>
      <mesh position={[0, -0.445, 0.048]}>
        <boxGeometry args={[0.54, 0.012, 0.008]} />
        <meshStandardMaterial color={secondary} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.56, -0.05]}>
        <torusGeometry args={[0.05, 0.008, 5, 12]} />
        <meshStandardMaterial color="#a5b3bb" metalness={0.5} roughness={0.42} />
      </mesh>
      <mesh position={[0, -0.54, -0.07]}>
        <boxGeometry args={[0.035, 2.18, 0.035]} />
        <meshStandardMaterial color="#a5b3bb" metalness={0.5} roughness={0.42} />
      </mesh>
      <mesh position={[0, -1.61, -0.07]}>
        <boxGeometry args={[0.58, 0.045, 0.43]} />
        <meshStandardMaterial color="#253744" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Static props, batched with the existing office/press set. No additional
 * actor rigs, lights, animation loop or requests are required for business scenes. */
export function CinematicBusinessDressing({
  business,
  primary,
  secondary,
  quality,
  language = "pt-BR",
}: {
  business: Business;
  primary: string;
  secondary: string;
  quality: QualityLevel;
  language?: string;
}) {
  const { kind, stage, clubName, subjectName } = business;
  const artwork = useMemo(
    () =>
      businessArtwork(
        { kind, stage, clubName, subjectName },
        primary,
        secondary,
        language,
        quality,
      ),
    [kind, stage, clubName, subjectName, primary, secondary, language, quality],
  );
  const paper = useMemo(
    () =>
      stage === "presentation"
        ? null
        : documentArtwork({ kind, stage, clubName, subjectName }, primary, language, quality),
    [kind, stage, clubName, subjectName, primary, language, quality],
  );
  useEffect(() => () => artwork?.dispose(), [artwork]);
  useEffect(() => () => paper?.dispose(), [paper]);
  const presentation = business.stage === "presentation";
  const signing = business.stage === "signing";
  return (
    <group name={`business-${business.kind}-${business.stage}`}>
      {/* Board signage stays left of the existing office window; the press
          banner sits in front of the existing backdrop, avoiding z-fighting. */}
      <mesh position={presentation ? [0, 3.72, -3.81] : [0, 3.18, -3.81]}>
        <boxGeometry args={presentation ? [6.96, 1.56, 0.055] : [3.16, 1.61, 0.055]} />
        <meshStandardMaterial color="#a5b3bb" metalness={0.5} roughness={0.42} />
      </mesh>
      <mesh position={presentation ? [0, 3.72, -3.776] : [0, 3.18, -3.776]}>
        <planeGeometry args={presentation ? [6.8, 1.42] : [3, 1.47]} />
        <meshStandardMaterial
          map={artwork}
          color={artwork ? "#ffffff" : primary}
          roughness={0.85}
        />
      </mesh>
      {!presentation && (
        <group name="business-document" position={[0.86, 0.81, -1.18]} rotation-y={-0.12}>
          <mesh position={[-0.025, 0, 0]}>
            <boxGeometry args={[0.59, 0.016, 0.74]} />
            <meshStandardMaterial color="#1c2c37" roughness={0.85} />
          </mesh>
          <mesh position={[-0.265, 0.012, 0]}>
            <boxGeometry args={[0.018, 0.006, 0.7]} />
            <meshStandardMaterial color="#c6ab65" metalness={0.5} roughness={0.42} />
          </mesh>
          <mesh position={[0, 0.012, 0.006]}>
            <boxGeometry args={[0.43, 0.006, 0.58]} />
            <meshStandardMaterial color="#d4d0c2" roughness={0.98} />
          </mesh>
          <mesh position={[0, 0.016, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.43, 0.58]} />
            <meshStandardMaterial
              map={paper}
              color={paper ? "#ffffff" : "#f0ecdc"}
              roughness={0.98}
            />
          </mesh>
          {/* The visible writing instrument remains on the desk. Actor hand
              props may animate independently in the existing rig. */}
          <group
            name="business-desk-pen"
            position={[signing ? 0.25 : -0.27, 0.029, 0.04]}
            rotation={[Math.PI / 2, 0, signing ? -0.28 : 0.08]}
          >
            <mesh>
              <cylinderGeometry args={[0.012, 0.01, 0.22, 8]} />
              <meshStandardMaterial color="#203642" roughness={0.35} metalness={0.25} />
            </mesh>
            <mesh position={[0, -0.13, 0]} rotation-z={Math.PI}>
              <coneGeometry args={[0.01, 0.04, 8]} />
              <meshStandardMaterial color="#c6ab65" metalness={0.5} roughness={0.42} />
            </mesh>
            <mesh position={[0, 0.092, 0]}>
              <cylinderGeometry args={[0.013, 0.013, 0.02, 8]} />
              <meshStandardMaterial color="#c6ab65" metalness={0.5} roughness={0.42} />
            </mesh>
          </group>
        </group>
      )}
      {business.kind === "transfer" && (presentation || quality !== "baixa") && (
        <group
          name="business-shirt-display"
          position={presentation ? [3.72, 1.64, -3.05] : [-2.55, 1.64, -3.36]}
        >
          <DisplayShirt primary={primary} secondary={secondary} quality={quality} />
        </group>
      )}
    </group>
  );
}
