/**
 * Cliente do Web Worker de simulação, com retorno automático para a thread
 * principal se o navegador não suportar workers (ou se o worker falhar).
 */
import { advanceRound, type MatchPerformance } from "./career";
import { autoSeason, type AutoWeek } from "./autoplay";
import {
  WorkerMatchView,
  resultMatch,
  snapshotMatch,
  type LiveResult,
  type LiveWorkerRequest,
  type LiveWorkerResponse,
} from "./live-match";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MAX_LIVE_MOTION_SCALE,
  MatchSim,
  type Side,
  type TeamSetup,
  type TeamTalkKind,
} from "./sim";
import {
  LIVE_MATCH_WORKER_TELEMETRY_NAME,
  createSnapshotTelemetryTracker,
} from "./snapshot-telemetry";
import type { CareerState } from "./types";
import type { Player, Tactics } from "./types";
import type { WeatherKind } from "./sim-rules";

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
  const activeWorker = w;
  const id = ++seq;
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      activeWorker.removeEventListener("message", onMsg);
      resolve(fallback());
    }, timeoutMs);
    function onMsg(ev: MessageEvent) {
      const data = ev.data as { id: number; ok: boolean; result?: T };
      if (!data || data.id !== id) return;
      clearTimeout(timer);
      activeWorker.removeEventListener("message", onMsg);
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
  talk(side: Side, kind: TeamTalkKind): Promise<boolean>;
  substitute(side: Side, outPid: string, incoming: Player): Promise<boolean>;
  skip(): void;
  dispose(): void;
}

export interface LiveMatchTelemetrySample {
  /** Origem do snapshot: Worker dedicado ou a contingência local. */
  source: "worker" | "fallback";
  /** O resultado final é medido junto com os snapshots normais. */
  kind: "snapshot" | "finished";
  sequence: number;
  /** Estimativa estrutural do clone entregue pela ponte, em bytes. */
  estimatedSerializedBytes: number;
  /** Cadência entre entregas recebidas neste lado da ponte. */
  intervalMs: number | null;
  /** Tempo gasto exclusivamente em WorkerMatchView.apply. */
  applyMs: number;
}

export interface LiveMatchTelemetryOptions {
  /**
   * Callback opt-in fora do React. Use uma ref, um buffer ou User Timing no
   * consumidor; não é preciso fazer setState a cada snapshot.
   */
  onSample(sample: LiveMatchTelemetrySample): void;
}

interface LiveMatchOptions {
  home: TeamSetup;
  away: TeamSetup;
  seed: string;
  knockout?: boolean;
  weather?: WeatherKind;
  view?: WorkerMatchView;
  onSnapshot: (view: WorkerMatchView) => void;
  onFinished: (view: WorkerMatchView) => void;
  onError?: (message: string) => void;
  telemetry?: LiveMatchTelemetryOptions;
}

type LiveWorkerCommand = LiveWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never;

function createLiveMatchWorker(telemetry: boolean) {
  return new Worker(new URL("./match.worker.ts", import.meta.url), {
    ...(telemetry ? { name: LIVE_MATCH_WORKER_TELEMETRY_NAME } : {}),
    type: "module",
  });
}

/**
 * Controlador dedicado à partida atual. A física roda no Worker; a tela recebe
 * apenas snapshots a 10 Hz e interpola as posições no próprio Canvas.
 */
export function createLiveMatchController(options: LiveMatchOptions): LiveMatchController {
  const view = options.view ?? new WorkerMatchView(options.home, options.away);
  const bootstrap = new MatchSim(options.home, options.away, options.seed, {
    knockout: options.knockout,
    weather: options.weather,
  });
  view.apply(snapshotMatch(bootstrap, 0));
  let liveWorker: Worker | null = null;
  let localSim: MatchSim | null = null;
  let localTimer: ReturnType<typeof setInterval> | null = null;
  let localSkipTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let localPaused = false;
  let localSpeed = 1;
  let sequence = 0;
  let command = 0;
  let latestState: LiveResult | Parameters<WorkerMatchView["apply"]>[0] | null = null;
  const pendingCommands = new Set<() => void>();
  const snapshotTelemetry = options.telemetry ? createSnapshotTelemetryTracker() : null;

  const apply = (
    state: LiveResult | Parameters<WorkerMatchView["apply"]>[0],
    source: LiveMatchTelemetrySample["source"],
  ) => {
    if (disposed) return;
    const applyStartedAt = snapshotTelemetry ? performance.now() : 0;
    const transport = snapshotTelemetry?.sample(state, applyStartedAt);
    view.apply(state);
    if (transport) {
      const sample: LiveMatchTelemetrySample = {
        source,
        kind: "ratings" in state ? "finished" : "snapshot",
        sequence: state.seq,
        ...transport,
        applyMs: Math.max(0, performance.now() - applyStartedAt),
      };
      // Uma sonda nunca deve interromper a partida ou acionar a contingência.
      try {
        options.telemetry?.onSample(sample);
      } catch {
        // O consumidor é opcional e externo à simulação.
      }
    }
    latestState = state;
    options.onSnapshot(view);
    if (state.finished) options.onFinished(view);
  };

  const stopLocal = () => {
    if (localTimer) clearInterval(localTimer);
    if (localSkipTimer) clearTimeout(localSkipTimer);
    localTimer = null;
    localSkipTimer = null;
  };

  const cancelPendingCommands = () => {
    for (const cancel of [...pendingCommands]) cancel();
  };

  const requestBoolean = (payload: LiveWorkerCommand): Promise<boolean> => {
    const current = liveWorker;
    if (!current) return Promise.resolve(false);
    const targetId = command + 1;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        current.removeEventListener("message", onMessage);
        pendingCommands.delete(cancel);
        resolve(result);
      };
      const onMessage = (event: MessageEvent<LiveWorkerResponse>) => {
        const message = event.data;
        if (!message.ok || message.id !== targetId || message.type !== "command") return;
        finish(message.result === true);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(cancel, 3000);
      pendingCommands.add(cancel);
      current.addEventListener("message", onMessage);
      current.postMessage({ id: ++command, ...payload });
    });
  };

  const startFallback = (reason?: string) => {
    cancelPendingCommands();
    liveWorker?.terminate();
    liveWorker = null;
    if (disposed || localSim) return;
    options.onError?.(reason ?? "Worker indisponível; simulação local ativada.");
    localSim = new MatchSim(options.home, options.away, options.seed, {
      knockout: options.knockout,
      weather: options.weather,
    });
    // Em caso de falha tardia, avança rapidamente até o último instante
    // confirmado antes de voltar à thread principal. Evita reiniciar o placar.
    if (latestState?.time) {
      let catchUp = 0;
      while (localSim.time < latestState.time && !localSim.finished && catchUp++ < 28_000) {
        localSim.step(Math.min(0.2, latestState.time - localSim.time));
      }
    }
    apply(snapshotMatch(localSim, ++sequence), "fallback");
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
        const motionScale = Math.min(localSpeed, MAX_LIVE_MOTION_SCALE);
        localSim.step(fixed * motionScale, (LIVE_MATCH_CLOCK_SCALE * localSpeed) / motionScale);
      }
      sequence += 1;
      apply(
        localSim.finished ? resultMatch(localSim, sequence) : snapshotMatch(localSim, sequence),
        "fallback",
      );
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
      liveWorker = createLiveMatchWorker(Boolean(options.telemetry));
      liveWorker.onmessage = (event: MessageEvent<LiveWorkerResponse>) => {
        const message = event.data;
        if (!message || !message.ok) {
          startFallback(message && "error" in message ? message.error : undefined);
          return;
        }
        if (message.type === "snapshot") apply(message.snapshot, "worker");
        else if (message.type === "finished") apply(message.result, "worker");
      };
      liveWorker.onerror = () =>
        startFallback("O Worker falhou; a partida continuou no modo compatível.");
      send({
        type: "startLive",
        home: options.home,
        away: options.away,
        seed: options.seed,
        knockout: options.knockout,
        weather: options.weather,
      });
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
    talk(side, kind) {
      if (localSim) return Promise.resolve(localSim.applyTeamTalk(side, kind));
      return requestBoolean({ type: "talkLive", side, kind });
    },
    substitute(side, outPid, incoming) {
      if (localSim) return Promise.resolve(localSim.substitute(side, outPid, incoming));
      return requestBoolean({ type: "substituteLive", side, outPid, incoming });
    },
    skip() {
      if (localSim) {
        stopLocal();
        let guard = 0;
        const finishInChunks = () => {
          if (!localSim || disposed) return;
          const end = Math.min(guard + 240, MATCH_SIMULATION_TICK_LIMIT);
          while (!localSim.finished && guard++ < end)
            localSim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
          if (localSim.finished || guard >= MATCH_SIMULATION_TICK_LIMIT) {
            sequence += 1;
            apply(resultMatch(localSim, sequence), "fallback");
            localSkipTimer = null;
            return;
          }
          localSkipTimer = setTimeout(finishInChunks, 0);
        };
        finishInChunks();
      } else send({ type: "skipLive" });
    },
    dispose() {
      disposed = true;
      send({ type: "stopLive" });
      cancelPendingCommands();
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

/** Mantém toda a temporada sequencial e determinística em um Worker dedicado. */
export function autoSeasonAsync(
  career: CareerState,
  maxWeeks = 60,
): Promise<{ weeks: AutoWeek[]; state: CareerState }> {
  return call({ type: "autoSeason", career, maxWeeks }, () => autoSeason(career, maxWeeks), 90_000);
}
