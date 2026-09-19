/**
 * Cliente do Web Worker de simulação, com retorno automático para a thread
 * principal se o navegador não suportar workers (ou se o worker falhar).
 */
import { advanceRound, type MatchPerformance } from "./career";
import {
  WorkerMatchView,
  resultMatch,
  snapshotMatch,
  type LiveResult,
  type LiveWorkerRequest,
  type LiveWorkerResponse,
} from "./live-match";
import { MatchSim, type Side, type TeamSetup } from "./sim";
import type { CareerState } from "./types";
import type { Player, Tactics } from "./types";

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

export interface LiveMatchController {
  view: WorkerMatchView;
  isWorker: boolean;
  pause(paused: boolean): void;
  setSpeed(speed: number): void;
  setTactics(side: Side, tactics: Tactics): void;
  substitute(side: Side, outPid: string, incoming: Player): Promise<boolean>;
  skip(): void;
  dispose(): void;
}

interface LiveMatchOptions {
  home: TeamSetup;
  away: TeamSetup;
  seed: string;
  view?: WorkerMatchView;
  onSnapshot: (view: WorkerMatchView) => void;
  onFinished: (view: WorkerMatchView) => void;
  onError?: (message: string) => void;
}

type LiveWorkerCommand = LiveWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never;

/**
 * Controlador dedicado à partida atual. A física roda no Worker; a tela recebe
 * apenas snapshots a 10 Hz e interpola as posições no próprio Canvas.
 */
export function createLiveMatchController(options: LiveMatchOptions): LiveMatchController {
  const view = options.view ?? new WorkerMatchView(options.home, options.away);
  const bootstrap = new MatchSim(options.home, options.away, options.seed);
  view.apply(snapshotMatch(bootstrap, 0));
  let liveWorker: Worker | null = null;
  let localSim: MatchSim | null = null;
  let localTimer: ReturnType<typeof setInterval> | null = null;
  let disposed = false;
  let localPaused = false;
  let localSpeed = 1;
  let sequence = 0;
  let command = 0;

  const apply = (state: LiveResult | Parameters<WorkerMatchView["apply"]>[0]) => {
    if (disposed) return;
    view.apply(state);
    options.onSnapshot(view);
    if (state.finished) options.onFinished(view);
  };

  const stopLocal = () => {
    if (localTimer) clearInterval(localTimer);
    localTimer = null;
  };

  const startFallback = (reason?: string) => {
    liveWorker?.terminate();
    liveWorker = null;
    if (disposed || localSim) return;
    options.onError?.(reason ?? "Worker indisponível; simulação local ativada.");
    localSim = new MatchSim(options.home, options.away, options.seed);
    let last = performance.now();
    let accumulator = 0;
    localTimer = setInterval(() => {
      if (!localSim || localPaused || disposed) return;
      const now = performance.now();
      accumulator = Math.min(accumulator + Math.min(0.15, (now - last) / 1000), 1 / 6);
      last = now;
      const fixed = 1 / 30;
      while (accumulator >= fixed && !localSim.finished) {
        accumulator -= fixed;
        localSim.step(fixed * 6 * localSpeed);
      }
      sequence += 1;
      apply(localSim.finished ? resultMatch(localSim, sequence) : snapshotMatch(localSim, sequence));
      if (localSim.finished) stopLocal();
    }, 100);
  };

  const send = (payload: LiveWorkerCommand) => {
    if (!liveWorker) return;
    command += 1;
    liveWorker.postMessage({ id: command, ...payload });
  };

  if (typeof Worker !== "undefined") {
    try {
      liveWorker = new Worker(new URL("./match.worker.ts", import.meta.url), { type: "module" });
      liveWorker.onmessage = (event: MessageEvent<LiveWorkerResponse>) => {
        const message = event.data;
        if (!message || !message.ok) {
          startFallback(message && "error" in message ? message.error : undefined);
          return;
        }
        if (message.type === "snapshot") apply(message.snapshot);
        else if (message.type === "finished") apply(message.result);
      };
      liveWorker.onerror = () => startFallback("O Worker falhou; a partida continuou no modo compatível.");
      send({ type: "startLive", home: options.home, away: options.away, seed: options.seed });
    } catch {
      startFallback();
    }
  } else {
    startFallback();
  }

  return {
    view,
    get isWorker() {
      return Boolean(liveWorker);
    },
    pause(value) {
      localPaused = value;
      send({ type: "pauseLive", paused: value });
    },
    setSpeed(value) {
      localSpeed = Math.max(1, Math.min(8, value));
      send({ type: "speedLive", speed: localSpeed });
    },
    setTactics(side, tactics) {
      const setup = side === "home" ? view.home : view.away;
      setup.tactics = { ...tactics };
      if (localSim) (side === "home" ? localSim.home : localSim.away).tactics = { ...tactics };
      send({ type: "tacticsLive", side, tactics });
    },
    substitute(side, outPid, incoming) {
      if (localSim) return Promise.resolve(localSim.substitute(side, outPid, incoming));
      return new Promise<boolean>((resolve) => {
        const targetId = command + 1;
        const current = liveWorker;
        if (!current) {
          resolve(false);
          return;
        }
        const onMessage = (event: MessageEvent<LiveWorkerResponse>) => {
          const message = event.data;
          if (!message.ok || message.id !== targetId || message.type !== "command") return;
          current.removeEventListener("message", onMessage);
          resolve(message.result === true);
        };
        current.addEventListener("message", onMessage);
        send({ type: "substituteLive", side, outPid, incoming });
        setTimeout(() => {
          current.removeEventListener("message", onMessage);
          resolve(false);
        }, 3000);
      });
    },
    skip() {
      if (localSim) {
        let guard = 0;
        while (!localSim.finished && guard++ < 200_000) localSim.step(0.4);
        sequence += 1;
        apply(resultMatch(localSim, sequence));
        stopLocal();
      } else send({ type: "skipLive" });
    },
    dispose() {
      disposed = true;
      send({ type: "stopLive" });
      liveWorker?.terminate();
      liveWorker = null;
      stopLocal();
    },
  };
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
