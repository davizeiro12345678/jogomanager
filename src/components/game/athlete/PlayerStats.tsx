// Small, presentation-only statistics used across athlete panels.
export function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="athlete-bar">
      <label>
        <span>{label}</span>
        <b>{Math.round(value)}</b>
      </label>
      <div className="athlete-track">
        <span className="athlete-fill" style={{ width: `${Math.round(value)}%` }} />
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
