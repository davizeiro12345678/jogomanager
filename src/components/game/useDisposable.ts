import { useEffect, useMemo, useRef, type DependencyList } from "react";

type Disposable = { dispose: () => void };

function isDisposable(value: unknown): value is Disposable {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { dispose?: unknown }).dispose === "function"
  );
}

/** Libera recursos Three (geometria, material, textura) contidos no valor. */
export function disposeDeep(value: unknown, seen = new Set<unknown>()): void {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (isDisposable(value)) {
    try {
      value.dispose();
    } catch {
      // Recurso já liberado ou contexto perdido: nada a fazer.
    }
    return;
  }
  const items = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const item of items) disposeDeep(item, seen);
}

/**
 * useMemo que libera a GPU quando o valor muda ou o componente desmonta.
 * A liberação é adiada um tick: no remonte do StrictMode o mesmo valor é
 * reaproveitado e não é descartado. Se algo ainda o usar, a Three reenviará
 * o buffer à GPU (fallback seguro, sem tela preta).
 */
export function useDisposable<T>(factory: () => T, deps: DependencyList): T {
  const value = useMemo(factory, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const active = useRef<T | null>(null);
  useEffect(() => {
    active.current = value;
    return () => {
      active.current = null;
      setTimeout(() => {
        if (active.current !== value) disposeDeep(value);
      }, 0);
    };
  }, [value]);
  return value;
}
