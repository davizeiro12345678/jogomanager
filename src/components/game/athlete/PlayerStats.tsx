// Small, presentation-only statistics used across athlete panels.
export function Bar({ label, value }: { label: string; value: number }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="athlete-bar">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">{label}</span>
        <b className="shrink-0">{score}</b>
      </div>
      <div
        className="athlete-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
      >
        <span className="athlete-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="athlete-meta text-xs uppercase">{label}</div>
    </div>
  );
}
