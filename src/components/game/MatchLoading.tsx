/** Reserves the match viewport while optional 3D code loads. */
export function MatchLoading() {
  return (
    <div
      role="status"
      className="flex h-full min-h-[70vh] flex-col items-center justify-center gap-3 bg-[#0b161c] px-6 text-center text-white"
    >
      <span
        aria-hidden
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-primary motion-reduce:animate-none"
      />
      <p className="font-display text-xl">Preparando o estádio</p>
      <p className="max-w-sm text-sm text-white/65">Carregando os gráficos da partida.</p>
    </div>
  );
}
