/**
 * Cliente do Web Worker de simulação, com retorno automático para a thread
 * principal se o navegador não suportar workers (ou se o worker falhar).
 */
import { advanceRound, type MatchPerformance } from "./career";
import type { CareerState } from "./types";

let worker: Worker | null = null;
let seq = 0;
let broken = false;

function getWorker(): Worker | null {
  if (broken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./match.worker.ts", import.meta.url), { type: "module" });
    worker.onerror = () => {
      broken = true;
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    broken = true;
    return null;
  }
}

function call<T>(
  payload: Record<string, unknown>,
  fallback: () => T,
  timeoutMs = 20_000,
): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.resolve(fallback());
  const id = ++seq;
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      w.removeEventListener("message", onMsg);
      resolve(fallback());
    }, timeoutMs);
    function onMsg(ev: MessageEvent) {
      const data = ev.data as { id: number; ok: boolean; result?: T };
      if (!data || data.id !== id) return;
      clearTimeout(timer);
      w!.removeEventListener("message", onMsg);
      resolve(data.ok && data.result !== undefined ? data.result : fallback());
    }
    w.addEventListener("message", onMsg);
    w.postMessage({ id, ...payload });
  });
}

/** Avança a rodada da carreira fora da thread da interface. */
export function advanceRoundAsync(
  career: CareerState,
  result: { hg: number; ag: number },
  performances: MatchPerformance[] = [],
): Promise<CareerState> {
  return call<CareerState>({ type: "advance", career, result, performances }, () =>
    advanceRound(career, result, performances),
  );
}
