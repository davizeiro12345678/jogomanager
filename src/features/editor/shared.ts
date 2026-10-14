import type { RoofKind, ChantKind } from "@/game/customStyle";
import type { CompetitionFormat } from "@/lib/customData";
import type { Position } from "@/game/types";

export const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];
export const POS_LABEL: Record<Position, string> = {
  GK: "Goleiro",
  DF: "Defensor",
  MF: "Meia",
  FW: "Atacante",
};
export const ROOFS: { id: RoofKind; label: string }[] = [
  { id: "aberto", label: "Sem cobertura" },
  { id: "parcial", label: "Cobertura parcial" },
  { id: "total", label: "Arena fechada" },
];
export const CHANTS: { id: ChantKind; label: string }[] = [
  { id: "carnaval", label: "Carnaval" },
  { id: "operario", label: "Operária" },
  { id: "epico", label: "Épica" },
  { id: "silencioso", label: "Reservada" },
];
export const FORMATS: CompetitionFormat[] = ["pontos-corridos", "mata-mata", "grupos-mata-mata"];
export const labelCls = "mb-1 block text-xs uppercase tracking-wide text-muted-foreground";

export function readImage(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("falha ao ler"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("imagem inválida"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("sem canvas"));
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
