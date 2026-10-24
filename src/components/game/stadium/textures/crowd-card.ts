import * as THREE from "three";

/** Neutral shaded impostor: skin/kit/hair tint still comes from each instance. */
export function crowdCard() {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const c = canvas.getContext("2d");
  if (!c) return new THREE.Texture();
  const fill = (x: number, y: number, rx: number, ry: number) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  const face = c.createLinearGradient(20, 0, 44, 0);
  face.addColorStop(0, "#a5a5a5");
  face.addColorStop(0.45, "#ffffff");
  face.addColorStop(1, "#c7c7c7");
  c.fillStyle = face;
  fill(21, 22, 3, 4);
  fill(43, 22, 3, 4);
  fill(32, 21, 10, 14);
  c.fillRect(28, 31, 8, 9);
  const shirt = c.createLinearGradient(9, 38, 55, 80);
  shirt.addColorStop(0, "#c0c0c0");
  shirt.addColorStop(0.42, "#ffffff");
  shirt.addColorStop(1, "#a8a8a8");
  c.fillStyle = shirt;
  c.beginPath();
  c.moveTo(18, 39);
  c.quadraticCurveTo(32, 33, 46, 39);
  c.lineTo(49, 79);
  c.quadraticCurveTo(32, 83, 15, 79);
  c.closePath();
  c.fill();
  // Silhouette includes upper arms, elbows and hands instead of a flat trapezoid.
  c.lineWidth = 7;
  c.lineCap = "round";
  c.strokeStyle = shirt;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(32 + side * 16, 43);
    c.lineTo(32 + side * 22, 59);
    c.lineTo(32 + side * 19, 73);
    c.stroke();
    c.fillStyle = face;
    fill(32 + side * 19, 74, 3, 4);
  }
  c.fillStyle = "#dddddd";
  c.fillRect(19, 80, 11, 39);
  c.fillRect(34, 80, 11, 39);
  c.fillStyle = "#8e8e8e";
  fill(23, 121, 7, 4);
  fill(41, 121, 7, 4);
  c.fillStyle = "#b4b4b4";
  fill(32, 12, 10, 6);
  c.fillStyle = "#737373";
  fill(28, 22, 1.2, 0.9);
  fill(36, 22, 1.2, 0.9);
  c.fillStyle = "#b0b0b0";
  fill(32, 29, 3, 0.8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "supporter-shaded-card";
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
