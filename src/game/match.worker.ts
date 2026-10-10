/// <reference lib="webworker" />
import { resultMatch, snapshotMatch, type LiveWorkerRequest } from "./live-match";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MAX_LIVE_MOTION_SCALE,
  MatchSim,
} from "./sim";

import type { RapierVisualPhysics } from "./rapier-ball-visual";
import {
  LIVE_MATCH_WORKER_TELEMETRY_MARK,
  createSnapshotTelemetryTracker,
  isLiveSnapshotResponse,
  isLiveTelemetryWorker,
  markLiveWorkerSnapshot,
} from "./snapshot-telemetry";
import { visualBallFromCanonical, type VisualBallState } from "./visual-ball";
import { initializeMatchExecution } from "./match-execution";
import { LiveSnapshotEncoder } from "./live-transport";
import { reportSilent } from "../lib/report-silent";
import { SequentialWorkerQueue } from "./sequential-worker-queue";
import { validMatchCommand } from "./match-command-validation";

let live: MatchSim | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let paused = true;
let speed = 1;
let sequence = 0;
let lastTick = 0;
let accumulator = 0;
let commandId = 0;
let skipToken = 0;
let visualPhysics: RapierVisualPhysics | null = null;
let visualPhysicsReady: Promise<RapierVisualPhysics | null> | null = null;
let visualPhysicsGeneration = 0;

let liveEpoch = 0;
let latestVisualBall: VisualBallState | undefined;
// Reenviar o histórico completo a cada 100 ms era trabalho de clone e GC que
// não melhora animação nem HUD. As posições continuam no mesmo ritmo; o feed
// só segue quando a simulação cria um evento novo.
let lastPublishedEventSeq = -1;
const commandQueue = new SequentialWorkerQueue();
let transport: LiveSnapshotEncoder | null = null;
let checkpointSeq = 0;
let checkpointAt = 0;
let recoveryDirty = true;
let recoveryTicks: Array<[number, number]> = [];

function recoveryState() {
  if (!live || !transport) return undefined;
  if (recoveryDirty || performance.now() - checkpointAt >= 2000) {
    const checkpoint = live.checkpoint();
    checkpointSeq++;
    checkpointAt = performance.now();
    recoveryDirty = false;
    recoveryTicks = [];
    post({ id: commandId, ok: true, type: "recovery", checkpoint, checkpointSeq });
  }
  return { checkpointSeq, ticks: recoveryTicks.map((tick) => [...tick] as [number, number]) };
}
const snapshotTelemetry = isLiveTelemetryWorker((self as unknown as { name?: unknown }).name)
  ? createSnapshotTelemetryTracker()
  : null;
let telemetryMarkCount = 0;

function post(message: unknown) {
  if (snapshotTelemetry && isLiveSnapshotResponse(message)) {
    const measurement = snapshotTelemetry.sample(message.snapshot, performance.now());
    // Mantém uma janela curta no User Timing do Worker para não acumular uma
    // entrada por snapshot durante partidas longas. Não altera a mensagem nem
    // toca no estado determinístico da simulação.
    if (telemetryMarkCount >= 120 && typeof performance.clearMarks === "function") {
      performance.clearMarks(LIVE_MATCH_WORKER_TELEMETRY_MARK);
      telemetryMarkCount = 0;
    }
    markLiveWorkerSnapshot(measurement);
    telemetryMarkCount += 1;
  }
  self.postMessage(message);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
  lastTick = 0;
  accumulator = 0;
  skipToken += 1;
}

function clearVisualPhysics() {
  visualPhysicsGeneration += 1;
  visualPhysics?.dispose();
  visualPhysics = null;
  visualPhysicsReady = null;
  latestVisualBall = undefined;
}

function getVisualPhysics() {
  const generation = visualPhysicsGeneration;
  return (visualPhysicsReady ??= import("./rapier-ball-visual")
    .then(({ createRapierVisualPhysics }) => createRapierVisualPhysics())
    .then((physics) => {
      if (generation !== visualPhysicsGeneration) {
        physics.dispose();
        return null;
      }
      visualPhysics = physics;
      return physics;
    })
    // Rapier é um aprimoramento visual. A partida não pode cair se o WASM
    // estiver indisponível em um navegador, dispositivo ou modo de economia.
    .catch(() => null));
}

async function attachVisualFallback(target: MatchSim, epoch: number) {
  const physics = await getVisualPhysics();
  if (!physics || target !== live || epoch !== liveEpoch || target.hasBallPhysicsAuthority())
    return;
  resetVisualPhysicsToCanonical();
}

function resetVisualPhysicsToCanonical() {
  if (!live) {
    latestVisualBall = undefined;
    return;
  }
  const canonical = live.physicsBallState();
  if (live.hasBallPhysicsAuthority()) {
    latestVisualBall = visualBallFromCanonical(canonical);
    return;
  }
  if (!visualPhysics) {
    latestVisualBall = undefined;
    return;
  }
  visualPhysics.reset(canonical);
  latestVisualBall = visualPhysics.read(canonical);
}

function publishSnapshot() {
  if (!live) return;
  if (transport) {
    const recovery = recoveryState();
    const snapshot = transport.encode({
      ...snapshotMatch(live, sequence + 1, latestVisualBall),
      ...(recovery ? { recovery } : {}),
    });
    if (!snapshot) return;
    sequence++;
    if (snapshotTelemetry) snapshotTelemetry.sample(snapshot, performance.now());
    self.postMessage({ id: commandId, ok: true, type: "packedSnapshot", snapshot }, [
      snapshot.frame.buffer,
    ]);
    return;
  }
  sequence += 1;
  const includeEvents = live.lastEventId !== lastPublishedEventSeq;
  if (includeEvents) lastPublishedEventSeq = live.lastEventId;
  post({
    id: commandId,
    ok: true,
    type: "snapshot",
    snapshot: snapshotMatch(live, sequence, latestVisualBall, includeEvents),
  });
}

function publishFinished() {
  if (!live) return;
  sequence += 1;
  post({
    id: commandId,
    ok: true,
    type: "finished",
    result: resultMatch(live, sequence, latestVisualBall),
  });
  paused = true;
  stopTimer();
}

function advanceLive(spatialDt: number, clockDt: number) {
  if (!live || live.finished) return;
  const before = live.physicsBallState();
  live.step(spatialDt, clockDt);
  if (transport) recoveryTicks.push([spatialDt, clockDt]);
  const after = live.physicsBallState();
  if (live.hasBallPhysicsAuthority()) {
    latestVisualBall = visualBallFromCanonical(after);
    return;
  }
  if (live.hasBallPhysicsAuthority()) {
    recoveryDirty = true;

    void attachVisualFallback(live, liveEpoch);
  }
  if (!visualPhysics) {
    latestVisualBall = undefined;
    return;
  }
  try {
    visualPhysics.synchronize(before, after);
    visualPhysics.step(spatialDt);
    latestVisualBall = visualPhysics.read(after);
  } catch {
    // Uma falha visual não pode alterar nem interromper MatchSim.
    visualPhysics.dispose();
    visualPhysics = null;
    latestVisualBall = undefined;
  }
}

function tick() {
  if (!live || paused || live.finished) return;
  const now = performance.now();
  const elapsed = Math.min(0.15, (now - (lastTick || now)) / 1000);
  lastTick = now;
  const fixed = 1 / 30;
  accumulator = Math.min(accumulator + elapsed, fixed * 5);
  while (accumulator >= fixed && !live.finished) {
    accumulator -= fixed;
    for (let step = 0; step < speed && !live.finished; step++)
      advanceLive(fixed, LIVE_MATCH_CLOCK_SCALE);
  }
  if (live.finished) publishFinished();
  else publishSnapshot();
}

function ensureTimer() {
  if (!timer) timer = setInterval(tick, 100);
}

async function startLive(message: Extract<LiveWorkerRequest, { type: "startLive" }>) {
  stopTimer();
  live?.dispose();
  live = null;
  transport = null;
  recoveryTicks = [];

  clearVisualPhysics();
  // Freeze the backend before the first step so loading timing cannot change
  // the seeded pass decisions halfway through a match.
  live = new MatchSim(message.home, message.away, message.seed, {
    knockout: message.knockout,
    weather: message.weather,
  });
  paused = false;
  speed = 1;
  sequence = 0;
  lastPublishedEventSeq = -1;
  const target = live;
  const epoch = ++liveEpoch;
  transport = message.compact ? new LiveSnapshotEncoder(epoch) : null;
  checkpointSeq = 0;
  checkpointAt = 0;
  recoveryDirty = true;
  recoveryTicks = [];
  await initializeMatchExecution(target);
  if (target !== live || epoch !== liveEpoch) {
    target.dispose();
    return;
  }
  if (target.hasBallPhysicsAuthority()) {
    latestVisualBall = visualBallFromCanonical(target.physicsBallState());
  } else void attachVisualFallback(target, epoch);
  publishSnapshot();
  ensureTimer();
  post({ id: message.id, ok: true, type: "ready" });
}

async function handleMessage(message: LiveWorkerRequest) {
  // Admission can precede execution by optional WASM initialization. Expired
  // controls are refused before changing the match or its recovery journal.
  if ("expiresAt" in message && Date.now() >= message.expiresAt) {
    post({ id: message.id, ok: true, type: "command", result: false });
    return;
  }
  if (message.type === "recycleLive") {
    transport?.recycle(message.session, message.slot, message.buffer);
    return;
  }
  if (message.type === "resyncLive") {
    transport?.resync();
    publishSnapshot();
    return;
  }
  commandId = message.id;
  if (message.type !== "startLive") recoveryDirty = true;
  if (message.type === "startLive") {
    await startLive(message);
    return;
  }
  if (message.type === "pauseLive") {
    paused = message.paused;
    lastTick = 0;
    // Não deixe um intervalo acordar o Worker a cada 100 ms enquanto a
    // partida está pausada. Retomamos o mesmo ciclo ao receber o comando de
    // continuar; isso reduz CPU ociosa sem alterar o estado da simulação.
    if (paused) stopTimer();
    else ensureTimer();
    post({ id: message.id, ok: true, type: "command" });
    return;
  }
  if (message.type === "speedLive") {
    if (!Number.isFinite(message.speed)) throw new Error("Velocidade de simulação inválida");
    speed = Math.max(1, Math.min(8, message.speed));
    post({ id: message.id, ok: true, type: "command" });
    return;
  }
  if (message.type === "tacticsLive" && live) {
    const setup = message.side === "home" ? live.home : live.away;
    setup.tactics = { ...message.tactics };
    publishSnapshot();
    post({ id: message.id, ok: true, type: "command", result: true });
    return;
  }
  if (message.type === "talkLive" && live) {
    const applied = live.applyTeamTalk(message.side, message.kind);
    publishSnapshot();
    post({ id: message.id, ok: true, type: "command", result: applied });
    return;
  }
  if (message.type === "substituteLive" && live) {
    const changed = live.substitute(message.side, message.outPid, message.incoming);
    if (changed) resetVisualPhysicsToCanonical();
    publishSnapshot();
    post({ id: message.id, ok: true, type: "command", result: changed });
    return;
  }
  if (message.type === "skipLive" && live) {
    paused = true;
    stopTimer();
    const token = skipToken;
    let guard = 0;
    const finishInChunks = () => {
      if (!live || token !== skipToken) return;
      const end = Math.min(guard + 320, MATCH_SIMULATION_TICK_LIMIT);
      // Keep live time/chance creation when skipping; large spatial steps
      // previously changed duels and played six times as much physical action.
      while (!live.finished && guard < end) {
        advanceLive(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
        guard++;
      }
      if (live.finished || guard >= MATCH_SIMULATION_TICK_LIMIT) {
        live.synchronizeBallPhysics();
        resetVisualPhysicsToCanonical();
        publishFinished();
        return;
      }
      setTimeout(finishInChunks, 0);
    };
    finishInChunks();
    return;
  }
  if (message.type === "stopLive") {
    paused = true;
    liveEpoch += 1;
    live?.dispose();
    live = null;
    transport = null;
    recoveryTicks = [];

    stopTimer();
    clearVisualPhysics();
    post({ id: message.id, ok: true, type: "command" });
    return;
  }
  if (message.type === "simulate") {
    const sim = new MatchSim(message.home, message.away, message.seed, {
      knockout: message.knockout,
      weather: message.weather,
    });
    try {
      await initializeMatchExecution(sim);
      let guard = 0;
      while (!sim.finished && guard++ < MATCH_SIMULATION_TICK_LIMIT)
        sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
      post({ id: message.id, ok: true, result: resultMatch(sim, 1) });
    } finally {
      sim.dispose();
    }
    return;
  }
  if (message.type === "advance") {
    const { advanceRound } = await import("./career");
    const career = advanceRound(
      message.career,
      message.result,
      message.performances,
      "Liga",
      message.evaluatedAt,
    );
    post({ id: message.id, ok: true, result: career });
    return;
  }
  if (message.type === "autoSeason") {
    const { autoSeason } = await import("./autoplay");
    post({
      id: message.id,
      ok: true,
      result: autoSeason(message.career, message.maxWeeks, message.evaluatedAt),
    });
    return;
  }
  throw new Error("Comando de simulação inválido");
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!validMatchCommand(message)) {
    const candidateId = (message as { id?: unknown } | null)?.id;
    const id =
      typeof candidateId === "number" && Number.isSafeInteger(candidateId) && candidateId >= 0
        ? candidateId
        : 0;
    post({ id, ok: false, code: "invalid-command", error: "Comando de simulação inválido" });
    return;
  }
  // Recycling is session-checked and never advances state. It must not wait
  // behind optional compilation or a long sequential career command.
  if (message.type === "recycleLive") {
    if (
      message.buffer instanceof ArrayBuffer &&
      Number.isSafeInteger(message.slot) &&
      Number.isSafeInteger(message.session)
    )
      transport?.recycle(message.session, message.slot, message.buffer);
    return;
  }
  // `startLive` aguarda o WASM. A fila evita que pause, velocidade ou troca
  // de atleta ultrapassem essa inicialização e produzam snapshots fora de ordem.
  const accepted = commandQueue.enqueue(
    () => handleMessage(message),
    (error) => {
      reportSilent("match-worker", error, {
        class: "degradation",
        code: "command-failed",
        phase: message.type,
      });
      post({
        id: message.id,
        ok: false,
        code: "command-failed",
        error: "Não foi possível executar o comando de simulação. Tente novamente.",
      });
    },
  );
  if (!accepted)
    post({
      id: message.id,
      ok: false,
      code: "queue-full",
      error: "Fila de simulação cheia. Aguarde o comando atual.",
    });
};
