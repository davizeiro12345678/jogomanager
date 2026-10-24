import * as THREE from "three";

/** Neutral shaded impostor: skin/kit/hair tint still comes from each instance. */
export function crowdCard(animated = false) {
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
  // Four 32×64 pose tiles retain the original 64×128 texture allocation.
  // Native WebGPU uses the same neutral idle drawing across the full card.
  const poses = animated ? 4 : 1;
  for (let pose = 0; pose < poses; pose++) {
    c.save();
    if (animated) {
      c.translate((pose % 2) * 32, Math.floor(pose / 2) * 64);
      c.scale(0.5, 0.5);
    }
    const face = c.createLinearGradient(20, 0, 44, 0);
    face.addColorStop(0, "#a5a5a5");
    face.addColorStop(0.45, "#ffffff");
    face.addColorStop(1, "#c7c7c7");
    c.fillStyle = face;
    fill(21, 30, 3, 4);
    fill(43, 30, 3, 4);
    fill(32, 29, 10, 13);
    c.fillRect(28, 39, 8, 8);
    const shirt = c.createLinearGradient(9, 45, 55, 83);
    shirt.addColorStop(0, "#b3b3b3");
    shirt.addColorStop(0.42, "#ffffff");
    shirt.addColorStop(1, "#999999");
    c.fillStyle = shirt;
    c.beginPath();
    c.moveTo(18, 45);
    c.quadraticCurveTo(32, 40, 46, 45);
    c.lineTo(47, 82);
    c.quadraticCurveTo(32, 86, 17, 82);
    c.closePath();
    c.fill();
    // Rest, overhead cheer, hands meeting in a clap, hands to head in disbelief.
    c.lineWidth = 7;
    c.lineCap = "round";
    c.strokeStyle = shirt;
    for (const side of [-1, 1]) {
      const elbowX = pose === 2 ? 32 + side * 15 : 32 + side * 24;
      const elbowY = pose === 0 ? 63 : pose === 1 ? 27 : 46;
      const handX = pose === 2 ? 32 + side * 3 : 32 + side * (pose === 3 ? 10 : 23);
      const handY = pose === 0 ? 77 : pose === 1 ? 9 : pose === 2 ? 40 : 24;
      c.beginPath();
      c.moveTo(32 + side * 15, 48);
      c.lineTo(elbowX, elbowY);
      c.lineTo(handX, handY);
      c.stroke();
      c.fillStyle = face;
      fill(handX, handY, 3.5, 4);
    }
    c.fillStyle = "#c9c9c9";
    c.fillRect(19, 84, 11, 34);
    c.fillRect(34, 84, 11, 34);
    c.fillStyle = "#707070";
    fill(23, 121, 7, 4);
    fill(41, 121, 7, 4);
    c.fillStyle = "#8e8e8e";
    fill(32, 20, 10, 5);
    c.fillStyle = "#555555";
    fill(28, 30, 1.2, 0.9);
    fill(36, 30, 1.2, 0.9);
    c.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "supporter-shaded-card";
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
