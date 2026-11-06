import { slugifyClubId, type MyClub } from "./myClub";

/** Export mechanics are separate from club creation and career save ownership. */
export function exportClubPortrait(c: MyClub) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const g = canvas.getContext("2d");
  if (!g) return;

  const bg = g.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, c.primary);
  bg.addColorStop(1, "#0a0f0c");
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 512);

  // escudo
  g.beginPath();
  g.moveTo(256, 96);
  g.lineTo(392, 148);
  g.quadraticCurveTo(392, 320, 256, 404);
  g.quadraticCurveTo(120, 320, 120, 148);
  g.closePath();
  g.fillStyle = c.secondary;
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.stroke();

  g.save();
  g.clip();
  g.fillStyle = c.primary;
  for (let i = 0; i < 6; i++) g.fillRect(120 + i * 48, 96, 24, 320);
  g.restore();

  g.fillStyle = "#0a0f0c";
  g.textAlign = "center";
  g.font = "bold 84px system-ui, sans-serif";
  g.fillText(c.short, 256, 290);

  g.fillStyle = "#eafff2";
  g.font = "bold 38px system-ui, sans-serif";
  g.fillText(c.name.toUpperCase().slice(0, 22), 256, 456);
  g.font = "22px system-ui, sans-serif";
  g.fillStyle = "rgba(234,255,242,0.75)";
  g.fillText(`${c.city || "—"} · ${c.founded}`, 256, 490);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `${slugifyClubId(c.name)}-retrato.png`;
  a.click();
}
