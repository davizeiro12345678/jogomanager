// ============================================================================
//  MatchMinimap.tsx
//  Radar 2D da partida: pontinhos dos 22 atletas + bola, lido direto da vista
//  mutável da simulação (sem estado React — redesenha num canvas a 12 fps).
//
//  O anel branco marca quem está com a bola; o lado com a posse ganha um brilho
//  na borda. Botão M alterna (tecla e clique), e some sozinho no celular.
// ============================================================================

import { memo, useEffect, useRef, useState } from "react";
import { Radar } from "lucide-react";

import { FIELD_X, FIELD_Z, type SimView } from "@/game/sim";

const W = 232;
const H = 152;
const PAD = 10;

function useMinimap(view: SimView, on: boolean) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!on) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    const px = (x: number) => PAD + ((x + FIELD_X) / (FIELD_X * 2)) * (W - PAD * 2);
    const pz = (z: number) => PAD + ((z + FIELD_Z) / (FIELD_Z * 2)) * (H - PAD * 2);

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 84) return; // ~12 fps: radar não precisa de mais
      last = t;
      ctx.clearRect(0, 0, W, H);
      // gramado
      ctx.fillStyle = "rgba(10, 60, 32, 0.92)";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
      ctx.beginPath();
      ctx.moveTo(W / 2, PAD);
      ctx.lineTo(W / 2, H - PAD);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 14, 0, Math.PI * 2);
      ctx.stroke();
      // áreas
      const boxW = (16.5 / (FIELD_X * 2)) * (W - PAD * 2);
      const boxH = (40.3 / (FIELD_Z * 2)) * (H - PAD * 2);
      ctx.strokeRect(PAD, H / 2 - boxH / 2, boxW, boxH);
      ctx.strokeRect(W - PAD - boxW, H / 2 - boxH / 2, boxW, boxH);

      const hp = view.home.primary;
      const ap = view.away.primary;
      for (const p of view.players) {
        ctx.beginPath();
        ctx.fillStyle = p.side === "home" ? hp : ap;
        ctx.arc(px(p.x), pz(p.z), 3.1, 0, Math.PI * 2);
        ctx.fill();
        if (view.ball.holder === p.id) {
          ctx.beginPath();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.6;
          ctx.arc(px(p.x), pz(p.z), 5.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      // bola com brilho
      const bx = px(view.ball.x);
      const bz = pz(view.ball.z);
      const glow = ctx.createRadialGradient(bx, bz, 0, bx, bz, 8);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.45, "rgba(255,235,180,0.55)");
      glow.addColorStop(1, "rgba(255,235,180,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bx, bz, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(bx, bz, 2.4, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [view, on]);
  return ref;
}

export const MatchMinimap = memo(function MatchMinimap({ view }: { view: SimView }) {
  const [on, setOn] = useState(true);
  const ref = useMinimap(view, on);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") setOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-3 z-20 hidden md:block">
      {on ? (
        <div className="overflow-hidden rounded-xl border border-white/12 bg-black/70 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <canvas ref={ref} width={W} height={H} aria-label="Radar da partida" role="img" />
          <button
            type="button"
            onClick={() => setOn(false)}
            className="block w-full bg-white/5 py-1 text-center text-[10px] uppercase tracking-widest text-white/55 hover:bg-white/10 hover:text-white/85"
          >
            Ocultar radar (M)
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOn(true)}
          aria-label="Mostrar radar da partida"
          className="rounded-full border border-white/12 bg-black/70 p-2.5 text-white/70 shadow-xl backdrop-blur-xl hover:text-white"
        >
          <Radar size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});
