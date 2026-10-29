import { useEffect, useState } from "react";
import { keepScreenAwake, type ScreenLockState } from "@/lib/screen-wake-lock";

/** Optional browser enhancement, loaded only inside an active match or replay. */
export function ScreenAwakeControl({
  running,
  className,
}: {
  running: boolean;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<ScreenLockState>("released");
  useEffect(() => setSupported(typeof navigator.wakeLock?.request === "function"), []);
  useEffect(() => {
    if (!enabled || !running || !supported) return;
    return keepScreenAwake(document, navigator.wakeLock, setState);
  }, [enabled, running, supported]);
  if (!supported) return null;
  const label = !enabled
    ? "Manter tela acesa"
    : !running
      ? "Tela acesa ao retomar"
      : state === "active"
        ? "Tela mantida acesa"
        : state === "unavailable" || state === "released"
          ? "Tela acesa indisponível"
          : "Ativando tela acesa";
  return (
    <button
      type="button"
      className={className ?? "rounded-lg border border-border/60 px-3 py-1.5 text-xs"}
      aria-pressed={enabled}
      title="Evita o bloqueio automático durante a reprodução. O aparelho pode recusar para economizar bateria."
      onClick={() => setEnabled((value) => !value)}
    >
      {label}
    </button>
  );
}
