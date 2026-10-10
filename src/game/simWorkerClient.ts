/**
 * Cliente do Web Worker de simulação, com retorno automático para a thread
 * principal se o navegador não suportar workers (ou se o worker falhar).
 */
import { advanceRound, type MatchPerformance } from "./career";
import type { AutoWeek } from "./autoplay";
import {
  WorkerMatchView,
  resultMatch,
  snapshotMatch,
  type LiveResult,
  type LiveSnapshot,
  type LiveWorkerRequest,
  type LiveWorkerResponse,
} from "./live-match";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MatchSim,
  type Side,
  type TeamSetup,
  type TeamTalkKind,
  type MatchCheckpoint,
} from "./sim";
import {
  LIVE_MATCH_WORKER_TELEMETRY_NAME,
  createSnapshotTelemetryTracker,
  estimateSerializedCloneBytes,
} from "./snapshot-telemetry";
import type { CareerState } from "./types";
import type { Player, Tactics } from "./types";
import type { WeatherKind } from "./sim-rules";
import { LiveSnapshotDecoder } from "./live-transport";
import { reportSilent } from "../lib/report-silent";
import { recoverMatch } from "./match-recovery";
import { LIVE_CONTROL_RESPONSE_TIMEOUT_MS, validMatchCommand } from "./match-command-validation";
import { MAX_PENDING_SIMULATION_COMMANDS } from "./sequential-worker-queue";
import { initializeMatchExecution } from "./match-execution";
import { autoSeasonCooperative } from "./season-cooperative";

let worker: Worker | null = null;
let seq = 0;
let broken = false;
let workerRestarts = 0;
let localCareerQueue: Promise<unknown> = Promise.resolve();
let localCareerPending = 0;
function localCareerCall<T>(fallback: () => T | Promise<T>): Promise<T> {
  if (localCareerPending >= MAX_PENDING_SIMULATION_COMMANDS)
    return Promise.reject(new Error("Fila de simulação cheia. Aguarde o comando atual."));
  localCareerPending++;
  const result = localCareerQueue.then(fallback);
  localCareerQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result.finally(() => {
    localCareerPending--;
  });
}
const pendingCareerCalls = new Map<number, () => void>();

function failCareerWorker(target: Worker): void {
  if (worker !== target) return;
  broken = true;
  worker = null;
  target.onerror = null;
  target.onmessageerror = null;
  target.terminate();
  for (const settle of [...pendingCareerCalls.values()]) settle();
}

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (broken) {
    if (workerRestarts >= 1 || pendingCareerCalls.size || localCareerPending) return null;
    workerRestarts++;
    broken = false;
  }
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./match.worker.ts", import.meta.url), { type: "module" });
    const target = worker;
    worker.onerror = () => failCareerWorker(target);
    worker.onmessageerror = () => failCareerWorker(target);
    return worker;
  } catch {
    broken = true;
    return null;
  }
}

function call<T>(
  payload: Record<string, unknown>,
  fallback: () => T | Promise<T>,
  timeoutMs = 20_000,
): Promise<T> {
  if (pendingCareerCalls.size >= MAX_PENDING_SIMULATION_COMMANDS)
    return Promise.reject(new Error("Fila de simulação cheia. Aguarde o comando atual."));
  if (!validMatchCommand({ id: 0, ...payload }))
    return Promise.reject(new Error("Comando de simulação inválido"));
  const w = getWorker();
  if (!w) return localCareerCall(fallback);
  const activeWorker = w;
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    function finish(result?: T, useFallback = true, error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pendingCareerCalls.delete(id);
      activeWorker.removeEventListener("message", onMsg);
      if (error) {
        reject(error);
        return;
      }
      try {
        resolve(useFallback ? localCareerCall(fallback) : result!);
      } catch (error) {
        reject(error);
      }
    }
    const timer = setTimeout(() => {
      // Kill the stale sequential queue before starting local recovery. A late
      // response must not revive work or leave other requests waiting 90 s.
      failCareerWorker(activeWorker);
    }, timeoutMs);
    function onMsg(ev: MessageEvent) {
      const data = ev.data as { id: number; ok: boolean; result?: T; error?: unknown };
      if (!data || data.id !== id) return;
      // An explicit rejection is not a transport failure. Re-executing it on
      // the UI thread bypasses both validation and bounded worker backpressure.
      if (data.ok === false) {
        finish(
          undefined,
          false,
          new Error(
            typeof data.error === "string" ? data.error : "Comando de simulação rejeitado.",
          ),
        );
      } else if (data.ok === true && data.result !== undefined) finish(data.result, false);
      else failCareerWorker(activeWorker);
    }
    pendingCareerCalls.set(id, () => finish());
    w.addEventListener("message", onMsg);
    try {
      w.postMessage({ id, ...payload });
    } catch {
      failCareerWorker(activeWorker);
    }
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
  /** Checkpoints recebidos desde a última entrega, contabilizados separadamente. */
  recoveryBytes?: number;
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

function bootstrapView(view: WorkerMatchView, options: LiveMatchOptions): void {
  const sim = new MatchSim(options.home, options.away, options.seed, {
    knockout: options.knockout,
    weather: options.weather,
  });
  try {
    view.apply(snapshotMatch(sim, 0));
  } finally {
    sim.dispose();
  }
}

/**
 * Controlador dedicado à partida atual. A física roda no Worker; a tela recebe
 * apenas snapshots a 10 Hz e interpola as posições no próprio Canvas.
 */
export function createLiveMatchController(options: LiveMatchOptions): LiveMatchController {
  if (!validMatchCommand({ ...options, id: 0, type: "startLive" }))
    throw new Error("Comando de simulação inválido");
  const view = options.view ?? new WorkerMatchView(options.home, options.away);
  bootstrapView(view, options);
  let liveWorker: Worker | null = null;
  let localSim: MatchSim | null = null;
  let localTimer: ReturnType<typeof setInterval> | null = null;
  let localSkipTimer: ReturnType<typeof setTimeout> | null = null;
  let localTick: (() => void) | null = null;
  let localLast = 0;
  let disposed = false;
  let localPaused = false;
  let localSpeed = 1;
  let sequence = 0;
  let command = 0;
  let latestState: LiveResult | LiveSnapshot | null = null;
  const checkpoints = new Map<number, MatchCheckpoint>();
  let recovering = false;
  const initializationAbort = new AbortController();
  const deferredTactics = new Map<Side, Tactics>();
  const pendingCommands = new Set<() => void>();
  const confirmedTactics = {
    home: { id: 0, tactics: { ...view.home.tactics } },
    away: { id: 0, tactics: { ...view.away.tactics } },
  };
  const tacticsRequests = new Map<number, { side: Side; tactics: Tactics; pending: boolean }>();
  const snapshotTelemetry = options.telemetry ? createSnapshotTelemetryTracker() : null;
  const decoder = new LiveSnapshotDecoder();
  let consecutiveDecodeFailures = 0;
  let recoveryBytes = 0;

  const apply = (
    state: LiveResult | LiveSnapshot,
    source: LiveMatchTelemetrySample["source"],
    wire: unknown = state,
  ) => {
    if (disposed) return;
    const applyStartedAt = snapshotTelemetry ? performance.now() : 0;
    const transport = snapshotTelemetry?.sample(wire, applyStartedAt);
    view.apply(state);
    if (transport) {
      const sample: LiveMatchTelemetrySample = {
        source,
        kind: "ratings" in state ? "finished" : "snapshot",
        sequence: state.seq,
        ...transport,
        recoveryBytes,
        applyMs: Math.max(0, performance.now() - applyStartedAt),
      };
      recoveryBytes = 0;
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

  const settleTactics = (id: number, applied: boolean, acknowledged = true) => {
    const request = tacticsRequests.get(id);
    if (!request) return;
    if (acknowledged) {
      tacticsRequests.delete(id);
      if (applied && id > confirmedTactics[request.side].id)
        confirmedTactics[request.side] = { id, tactics: { ...request.tactics } };
    } else request.pending = false;
    const pending = [...tacticsRequests.values()].filter(
      (entry) => entry.side === request.side && entry.pending,
    );
    const setup = request.side === "home" ? view.home : view.away;
    setup.tactics = { ...(pending.at(-1)?.tactics ?? confirmedTactics[request.side].tactics) };
    // A late acknowledgement can still reconcile tactics after an uncertain
    // timeout, without re-executing the command or changing snapshot payloads.
    try {
      if (!disposed) options.onSnapshot(view);
    } catch (error) {
      reportSilent("match-worker", error, { class: "degradation", code: "tactics-view" });
    }
  };

  const requestBoolean = (
    payload: Extract<LiveWorkerCommand, { expiresAt: number }>,
    onSettled?: (result: boolean, acknowledged: boolean) => void,
  ): Promise<boolean> => {
    const current = liveWorker;
    if (!current || pendingCommands.size >= MAX_PENDING_SIMULATION_COMMANDS) {
      onSettled?.(false, true);
      return Promise.resolve(false);
    }
    const targetId = command + 1;
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean, acknowledged = true) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        current.removeEventListener("message", onMessage);
        pendingCommands.delete(cancel);
        onSettled?.(result, acknowledged);
        resolve(result);
      };
      const onMessage = (event: MessageEvent<LiveWorkerResponse>) => {
        const message = event.data;
        if (message.id !== targetId) return;
        if (!message.ok) {
          finish(false);
          return;
        }
        if (message.type !== "command") return;
        finish(message.result === true);
      };
      const cancel = () => finish(false);
      const timer = setTimeout(
        () => finish(false, false),
        Math.max(0, payload.expiresAt - Date.now()),
      );
      pendingCommands.add(cancel);
      current.addEventListener("message", onMessage);
      try {
        current.postMessage({ id: ++command, ...payload });
      } catch {
        finish(false);
        startFallback("Falha ao enviar comando; simulação local ativada.");
      }
    });
  };

  const startFallback = (reason?: string) => {
    cancelPendingCommands();
    for (const id of [...tacticsRequests.keys()]) settleTactics(id, false);
    if (liveWorker) {
      liveWorker.onmessage = null;
      liveWorker.onerror = null;
      liveWorker.onmessageerror = null;
    }
    liveWorker?.terminate();
    liveWorker = null;
    if (disposed || localSim || recovering) return;
    options.onError?.(reason ?? "Worker indisponível; simulação local ativada.");
    const startLocal = (restored: MatchSim) => {
      if (disposed) {
        restored.dispose();
        return;
      }
      for (const [side, tactics] of deferredTactics) {
        (side === "home" ? restored.home : restored.away).tactics = { ...tactics };
      }
      deferredTactics.clear();
      for (const side of ["home", "away"] as const) {
        const tactics = { ...(side === "home" ? restored.home : restored.away).tactics };
        (side === "home" ? view.home : view.away).tactics = tactics;
        confirmedTactics[side] = { id: command, tactics: { ...tactics } };
      }
      recovering = false;
      localSim = restored;
      apply(snapshotMatch(localSim, ++sequence), "fallback");
      let accumulator = 0;
      localLast = performance.now();
      localTick = () => {
        if (!localSim || localPaused || disposed) return;
        const now = performance.now();
        accumulator = Math.min(accumulator + Math.min(0.15, (now - localLast) / 1000), 1 / 6);
        localLast = now;
        const fixed = 1 / 30;
        while (accumulator >= fixed && !localSim.finished) {
          accumulator -= fixed;
          for (let step = 0; step < localSpeed && !localSim.finished; step++)
            localSim.step(fixed, LIVE_MATCH_CLOCK_SCALE);
        }
        sequence += 1;
        apply(
          localSim.finished ? resultMatch(localSim, sequence) : snapshotMatch(localSim, sequence),
          "fallback",
        );
        if (localSim.finished) stopLocal();
      };
      if (!localPaused) localTimer = setInterval(localTick, 100);
    };
    if (latestState !== null) {
      const confirmed = latestState;
      const checkpoint = checkpoints.get(confirmed.recovery?.checkpointSeq ?? -1);
      if (!checkpoint) {
        localPaused = true;
        reportSilent("match-recovery", "No matching confirmed checkpoint", {
          class: "fatal",
          code: "checkpoint-missing",
        });
        options.onError?.(
          "A partida foi preservada e pausada; não foi possível recuperar seu estado com segurança.",
        );
        return;
      }
      recovering = true;
      void recoverMatch(checkpoint, confirmed, () => disposed)
        .then(startLocal)
        .catch((error) => {
          recovering = false;
          localPaused = true;
          if (!disposed) {
            reportSilent("match-recovery", error, { class: "fatal", code: "restore-failed" });
            options.onError?.(
              "A partida permanece pausada. A recuperação não corresponde ao último estado confirmado.",
            );
          }
        });
    } else {
      const initial = new MatchSim(options.home, options.away, options.seed, {
        knockout: options.knockout,
        weather: options.weather,
      });
      recovering = true;
      void initializeMatchExecution(initial, initializationAbort.signal).then(
        () => startLocal(initial),
        () => {
          if (disposed) initial.dispose();
          else startLocal(initial);
        },
      );
    }
  };

  const send = (payload: LiveWorkerCommand) => {
    if (!liveWorker) return;
    command += 1;
    try {
      liveWorker.postMessage({ id: command, ...payload });
    } catch {
      startFallback("Falha ao enviar comando; simulação local ativada.");
    }
  };

  if (typeof Worker !== "undefined") {
    try {
      liveWorker = createLiveMatchWorker(Boolean(options.telemetry));
      liveWorker.onmessage = (event: MessageEvent<LiveWorkerResponse>) => {
        const message = event.data;
        if (!message || !message.ok) {
          if (message) settleTactics(message.id, false);
          if (
            message &&
            (message.code === "queue-full" ||
              message.code === "invalid-command" ||
              message.code === "command-failed")
          ) {
            options.onError?.(message.error);
            return;
          }
          startFallback(message && "error" in message ? message.error : undefined);
          return;
        }
        if (message.type === "command") settleTactics(message.id, message.result === true);
        else if (message.type === "recovery") {
          if (snapshotTelemetry) recoveryBytes += estimateSerializedCloneBytes(message.checkpoint);
          checkpoints.set(message.checkpointSeq, message.checkpoint);
          while (checkpoints.size > 3) checkpoints.delete(checkpoints.keys().next().value!);
        } else if (message.type === "packedSnapshot") {
          const packet = message.snapshot;
          const current = liveWorker;
          try {
            const state = decoder.decode(packet);
            if (state) {
              consecutiveDecodeFailures = 0;
              apply(state, "worker", packet);
            }
          } catch (error) {
            reportSilent("live-transport", error, {
              class: "degradation",
              code: "decode-frame",
              sequence: packet.seq,
            });
            consecutiveDecodeFailures++;
            if (consecutiveDecodeFailures >= 3) {
              startFallback("Falha persistente de transporte; recuperando a partida localmente.");
            } else {
              try {
                current?.postMessage({ id: command, type: "resyncLive" });
              } catch (resyncError) {
                reportSilent("live-transport", resyncError, {
                  class: "degradation",
                  code: "resync-failed",
                });
                startFallback(
                  "Não foi possível sincronizar o Worker; recuperando a partida localmente.",
                );
              }
            }
          } finally {
            try {
              if (current && current === liveWorker && packet.frame.buffer.byteLength)
                current.postMessage(
                  {
                    id: command,
                    type: "recycleLive",
                    session: packet.session,
                    slot: packet.slot,
                    buffer: packet.frame.buffer,
                  },
                  [packet.frame.buffer],
                );
            } catch (error) {
              reportSilent("live-transport", error, {
                class: "degradation",
                code: "recycle-frame",
              });
              startFallback("Falha de transporte; recuperação local ativada.");
            }
          }
        } else if (message.type === "snapshot") apply(message.snapshot, "worker");
        else if (message.type === "finished") apply(message.result, "worker");
      };
      liveWorker.onerror = (event) => {
        reportSilent("match-worker", event.error ?? event.message, {
          class: "degradation",
          code: "worker-error",
        });
        startFallback("O Worker falhou; a partida continuou no modo compatível.");
      };
      liveWorker.onmessageerror = (event) => {
        reportSilent("match-worker", event, { class: "degradation", code: "message-error" });
        startFallback("Falha ao ler a partida; recuperação local ativada.");
      };
      send({
        type: "startLive",
        compact: true,
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
      if (!validMatchCommand({ id: 0, type: "pauseLive", paused: value })) return;
      localPaused = value;
      if (localSim) {
        if (value && localTimer) {
          clearInterval(localTimer);
          localTimer = null;
        } else if (!value && !localTimer && !localSkipTimer && localTick && !localSim.finished) {
          localLast = performance.now();
          localTimer = setInterval(localTick, 100);
        }
      }
      send({ type: "pauseLive", paused: value });
    },
    setSpeed(value) {
      if (!Number.isFinite(value)) return;
      localSpeed = Math.max(1, Math.min(8, value));
      send({ type: "speedLive", speed: localSpeed });
    },
    setTactics(side, tactics) {
      const expiresAt = Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;
      if (!validMatchCommand({ id: 0, type: "tacticsLive", side, tactics, expiresAt })) return;
      if (recovering) {
        deferredTactics.set(side, { ...tactics });
        return;
      }
      if (!liveWorker && !localSim) return;
      const setup = side === "home" ? view.home : view.away;
      setup.tactics = { ...tactics };
      if (localSim) {
        (side === "home" ? localSim.home : localSim.away).tactics = { ...tactics };
        confirmedTactics[side] = { id: command, tactics: { ...tactics } };
        return;
      }
      const id = command + 1;
      tacticsRequests.set(id, { side, tactics: { ...tactics }, pending: true });
      // Completed, unacknowledged requests only exist to reconcile late replies.
      while (tacticsRequests.size > MAX_PENDING_SIMULATION_COMMANDS * 2) {
        const oldest = [...tacticsRequests].find(([, request]) => !request.pending);
        if (!oldest) break;
        tacticsRequests.delete(oldest[0]);
      }
      void requestBoolean(
        { type: "tacticsLive", side, tactics, expiresAt },
        (applied, acknowledged) => settleTactics(id, applied, acknowledged),
      );
    },
    talk(side, kind) {
      const expiresAt = Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;
      if (!validMatchCommand({ id: 0, type: "talkLive", side, kind, expiresAt }))
        return Promise.resolve(false);
      if (localSim) return Promise.resolve(localSim.applyTeamTalk(side, kind));
      return requestBoolean({ type: "talkLive", side, kind, expiresAt });
    },
    substitute(side, outPid, incoming) {
      const expiresAt = Date.now() + LIVE_CONTROL_RESPONSE_TIMEOUT_MS;
      if (!validMatchCommand({ id: 0, type: "substituteLive", side, outPid, incoming, expiresAt }))
        return Promise.resolve(false);
      if (localSim) return Promise.resolve(localSim.substitute(side, outPid, incoming));
      return requestBoolean({ type: "substituteLive", side, outPid, incoming, expiresAt });
    },
    skip() {
      if (localSim) {
        stopLocal();
        let guard = 0;
        const finishInChunks = () => {
          if (!localSim || disposed) return;
          const end = Math.min(guard + 240, MATCH_SIMULATION_TICK_LIMIT);
          while (!localSim.finished && guard < end) {
            localSim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
            guard++;
          }
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
      if (disposed) return;
      disposed = true;
      initializationAbort.abort();
      // Termination stops the worker immediately; posting a stop message first
      // only clones a command that the worker may never receive.
      cancelPendingCommands();
      if (liveWorker) {
        liveWorker.onmessage = null;
        liveWorker.onerror = null;
        liveWorker.onmessageerror = null;
        liveWorker.terminate();
      }
      liveWorker = null;
      stopLocal();
      localSim?.dispose();
      localSim = null;
      localTick = null;
      latestState = null;
      checkpoints.clear();
      deferredTactics.clear();
      tacticsRequests.clear();
    },
  };
}

/** Avança a rodada da carreira fora da thread da interface. */
export function advanceRoundAsync(
  career: CareerState,
  result: { hg: number; ag: number },
  performances: MatchPerformance[] = [],
): Promise<CareerState> {
  const evaluatedAt = Date.now();
  return call<CareerState>({ type: "advance", career, result, performances, evaluatedAt }, () =>
    advanceRound(career, result, performances, "Liga", evaluatedAt),
  );
}

/** Mantém toda a temporada sequencial e determinística em um Worker dedicado. */
export function autoSeasonAsync(
  career: CareerState,
  maxWeeks = 60,
): Promise<{ weeks: AutoWeek[]; state: CareerState }> {
  const evaluatedAt = Date.now();
  return call(
    { type: "autoSeason", career, maxWeeks, evaluatedAt },
    () => autoSeasonCooperative(career, maxWeeks, evaluatedAt),
    90_000,
  );
}
