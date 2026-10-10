import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SceneArt } from "@/content/cutscenes";
import type { CinematicSet } from "@/game/cinematic-blocking";
import { useT } from "@/i18n/provider";

export type CinematicArtwork = CinematicSet | "stadium" | "medical" | "gym";

const LABELS: Record<Exclude<CinematicArtwork, "stadium">, [string, string]> = {
  locker: ["JUNTOS, ATÉ O FIM", "UM ESCUDO. UMA EQUIPE."],
  tunnel: ["O CAMPO NOS ESPERA", "CONCENTRAÇÃO · RESPEITO · ENTREGA"],
  press: ["SALA DE IMPRENSA", "FUTEBOL · CLUBE · COMUNIDADE"],
  pitch: ["NOSSA CASA, NOSSO JOGO", "CADA MINUTO CONTA"],
  stands: ["AQUI É A NOSSA CASA", "A VOZ DA ARQUIBANCADA"],
  office: ["O FUTURO SE CONSTRÓI AQUI", "PLANEJAMENTO · IDENTIDADE · FUTEBOL"],
  arrival: ["BEM-VINDOS À NOSSA CASA", "ACESSO DA EQUIPE"],
  medical: ["RECUPERAR É EVOLUIR", "SAÚDE · MOVIMENTO · CUIDADO"],
  gym: ["FORÇA PARA IR ALÉM", "PREPARAÇÃO · EQUILÍBRIO · DESEMPENHO"],
};

/** Painted scenery supplies distant depth without another light, render pass,
 * model download or animated shader. The visible frame/architecture remains 3D. */
export function paintCinematicArtwork(
  ctx: CanvasRenderingContext2D,
  kind: CinematicArtwork,
  primary: string,
  secondary: string,
  art?: SceneArt,
  copy?: [string, string],
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.scale(w / 1024, h / 512);
  if (kind === "stadium") {
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, art === "tunnel" ? "#b3d2de" : "#5d8ca5");
    sky.addColorStop(0.57, "#c5d5d8");
    sky.addColorStop(1, "#4b6e61");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);
    // A perspective bowl with roof beams and small repeating seat sections.
    ctx.fillStyle = "#354b5a";
    ctx.beginPath();
    ctx.moveTo(0, 125);
    ctx.lineTo(512, 245);
    ctx.lineTo(1024, 125);
    ctx.lineTo(1024, 325);
    ctx.lineTo(512, 305);
    ctx.lineTo(0, 325);
    ctx.closePath();
    ctx.fill();
    for (let row = 0; row < 8; row++) {
      const y = 192 + row * 15;
      ctx.strokeStyle = row % 2 ? "#61798b" : "#82949f";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, y - 26);
      ctx.lineTo(512, y + 30);
      ctx.lineTo(1024, y - 26);
      ctx.stroke();
    }
    ctx.strokeStyle = "#283c49";
    ctx.lineWidth = 6;
    for (let i = 0; i <= 12; i++) {
      const x = (i * 1024) / 12;
      ctx.beginPath();
      ctx.moveTo(x, 140);
      ctx.lineTo(512 + (x - 512) * 0.82, 320);
      ctx.stroke();
    }
    ctx.fillStyle = "#5b875a";
    ctx.beginPath();
    ctx.moveTo(330, 305);
    ctx.lineTo(694, 305);
    ctx.lineTo(1130, 512);
    ctx.lineTo(-106, 512);
    ctx.closePath();
    ctx.fill();
    for (let row = 0; row < 5; row++) {
      ctx.fillStyle = row % 2 ? "#548153" : "#5e8d5c";
      const near = 330 - row * 80;
      const far = near - 80;
      ctx.beginPath();
      ctx.moveTo(near, 305 + row * 41);
      ctx.lineTo(1024 - near, 305 + row * 41);
      ctx.lineTo(1024 - far, 346 + row * 41);
      ctx.lineTo(far, 346 + row * 41);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#dbe4d5";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(512, 305);
    ctx.lineTo(512, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(512, 390, 118, 23, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(442, 309, 140, 37);
    ctx.fillStyle = primary;
    ctx.fillRect(0, 299, 1024, 7);
    ctx.restore();
    return;
  }
  const [title, caption] = copy ?? LABELS[kind];
  const shade = ctx.createLinearGradient(0, 0, 1024, 512);
  shade.addColorStop(0, "#132735");
  shade.addColorStop(1, "#253e4c");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1024, 512);
  // Wide diagonal colour fields read clearly behind actors at every quality.
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(296, 0);
  ctx.lineTo(105, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(990, 0);
  ctx.lineTo(1024, 0);
  ctx.lineTo(1024, 512);
  ctx.lineTo(800, 512);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(290 + i * 90, 0);
    ctx.lineTo(90 + i * 90, 512);
    ctx.stroke();
  }
  ctx.fillStyle = "#f3efe4";
  ctx.font = "800 58px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, 548, 229, 725);
  ctx.font = "600 22px sans-serif";
  ctx.fillText(caption, 548, 280, 700);
  ctx.fillStyle = "#c6ad79";
  ctx.fillRect(340, 314, 418, 4);
  // A restrained shield is a club motif, not an invented official crest.
  ctx.strokeStyle = "#f3efe4";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(63, 156);
  ctx.lineTo(159, 156);
  ctx.lineTo(155, 259);
  ctx.quadraticCurveTo(144, 302, 111, 325);
  ctx.quadraticCurveTo(78, 302, 67, 259);
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(111, 171);
  ctx.lineTo(111, 303);
  ctx.stroke();
  ctx.restore();
}

/** Each mounted set owns its artwork. Shared faces reuse one texture; no
 * global cache accumulates club palettes during previews or career switches. */
export function useCinematicArtwork(
  kind: CinematicArtwork,
  primary: string,
  secondary: string,
  art?: SceneArt,
) {
  const { t } = useT();
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d");
    if (!context) return null;
    paintCinematicArtwork(
      context,
      kind,
      primary,
      secondary,
      art,
      kind === "stadium"
        ? undefined
        : [t(`cinemaStudio.artwork.${kind}.title`), t(`cinemaStudio.artwork.${kind}.caption`)],
    );
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    value.anisotropy = 2;
    value.name = `cinematic-artwork:${kind}`;
    return value;
  }, [kind, primary, secondary, art, t]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}
