import { useEffect, useState } from "react";

/** Short, true gameplay tips shown while the 3D code downloads. */
const TIPS = [
  "Troque a câmera durante o jogo: transmissão, cinema, tática ou imersão.",
  "No intervalo, a conversa com o elenco mexe no moral e no fôlego do time.",
  "Jogadores cansados rendem menos: use as substituições no segundo tempo.",
  "Em aparelhos mais simples, o jogo baixa os gráficos sozinho para ficar fluido.",
  "Acelere a partida em até 8x quando quiser chegar logo ao apito final.",
] as const;

const TIP_EVERY_MS = 4500;
/** After this long the download is likely on a slow connection. */
const SLOW_AFTER_MS = 8000;

/** Reserves the match viewport while optional 3D code loads. */
export function MatchLoading() {
  const [tip, setTip] = useState(0);
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const rotate = window.setInterval(() => setTip((n) => (n + 1) % TIPS.length), TIP_EVERY_MS);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.clearInterval(rotate);
      window.clearTimeout(slowTimer);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground"
    >
      <span
        aria-hidden
        className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none"
      />
      <p className="font-display text-xl">Preparando o estádio</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {offline
          ? "Sem internet. O download continua assim que a conexão voltar."
          : slow
            ? "Sua conexão está lenta; ainda baixando os gráficos da partida."
            : "Baixando os gráficos da partida."}
      </p>
      <p className="mt-4 max-w-sm text-xs text-muted-foreground" aria-live="off">
        <span className="font-semibold text-primary">Dica: </span>
        {TIPS[tip]}
      </p>
    </div>
  );
}
