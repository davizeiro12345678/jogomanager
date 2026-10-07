type CutsceneLoadFallbackProps = {
  onIllustrated: () => void;
  onRetry: () => void;
};

export function CutsceneLoadFallback({ onIllustrated, onRetry }: CutsceneLoadFallbackProps) {
  return (
    <div className="cutscene-load-fallback" role="alert" aria-live="assertive">
      <strong>A cena 3D não ficou disponível</strong>
      <span>
        O diálogo continua seguro na versão ilustrada. Você pode tentar o palco novamente.
      </span>
      <div className="cutscene-load-fallback-actions">
        <button type="button" onClick={onIllustrated}>
          Abrir cena ilustrada
        </button>
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
