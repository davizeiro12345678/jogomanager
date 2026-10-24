import * as THREE from "three";

/** Neutral shaded impostor: skin/kit/hair tint still comes from each instance. */
export function crowdCard(animated = false) {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = animated ? 512 : 64;
  canvas.height = animated ? 512 : 128;
  const c = canvas.getContext("2d");
  if (!c) return new THREE.Texture();
  const fill = (x: number, y: number, rx: number, ry: number) => {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  };
  // Four gestures × eight phases: 64×128 tiles, 1 MiB RGBA before mipmaps.
  // Native WebGPU uses the same neutral idle drawing across the full card.
  const poses = animated ? 32 : 1;
  for (let tile = 0; tile < poses; tile++) {
    const pose = animated ? Math.floor(tile / 8) : 0;
    const phase = animated ? (tile % 8) / 8 : 0;
    const reach = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    c.save();
    if (animated) {
      c.translate((tile % 8) * 64, Math.floor(tile / 8) * 128);
      // Clip each tile to prevent filtering from picking neighbouring limbs.
      c.beginPath();
      c.rect(0, 0, 64, 128);
      c.clip();
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
      const elbowX = pose === 2 ? 32 + side * (15 - reach * 4) : 32 + side * 24;
      const elbowY = pose === 0 ? 63 + reach * 2 : pose === 1 ? 35 - reach * 10 : 46 - reach * 3;
      const handX =
        pose === 2 ? 32 + side * (12 - reach * 9) : 32 + side * (pose === 3 ? 15 - reach * 5 : 23);
      const handY =
        pose === 0
          ? 77 - reach * 2
          : pose === 1
            ? 21 - reach * 12
            : pose === 2
              ? 44 - reach * 4
              : 30 - reach * 6;
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
