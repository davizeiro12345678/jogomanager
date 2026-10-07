/// <reference lib="webworker" />
import {
  resultMatch,
  snapshotMatchPacket,
  type LiveWorkerRequest,
} from "./live-match";
import {
  LIVE_MATCH_CLOCK_SCALE,
  MATCH_SIMULATION_STEP,
  MATCH_SIMULATION_TICK_LIMIT,
  MAX_LIVE_MOTION_SCALE,
  MatchSim,
} from "./sim";
import type { BallPhysicsAuthority } from "./rapier-ball-authority";
import type { RapierVisualPhysics } from "./rapier-ball-visual";
import {
  LIVE_MATCH_WORKER_TELEMETRY_MARK,
  createSnapshotTelemetryTracker,
  isLiveSnapshotResponse,
  isLiveTelemetryWorker,
  markLiveWorkerSnapshot,
} from "./snapshot-telemetry";
import { visualBallFromCanonical, type VisualBallState } from "./visual-ball";
import { loadPassLaneKernel } from "./wasm/match-perception";
import { serializeWorkerError } from "./worker-error";
import { createSnapshotBufferPool } from "./live-match-buffer";

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
let ballAuthority: BallPhysicsAuthority | null = null;
let liveEpoch = 0;
let latestVisualBall: VisualBallState | undefined;
let commandQueue: Promise<void> = Promise.resolve();
const snapshotTelemetry = isLiveTelemetryWorker((self as unknown as { name?: unknown }).name)
  ? createSnapshotTelemetryTracker()
  : null;
let telemetryMarkCount = 0;
let lastProtocolErrorKey = "";
const snapshotPool = createSnapshotBufferPool(3);
let rosterVersion = 1;
let publishedRosterVersion = 0;

function post(message: unknown, transfer: Transferable[] = []) {
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
  self.postMessage(message, transfer);
}

function publishWorkerError(event: ErrorEvent | MessageEvent | PromiseRejectionEvent) {
  const payload = serializeWorkerError(event);
  const key = `${commandId}:${payload.kind}:${payload.message}`;
  if (key === lastProtocolErrorKey) return;
  lastProtocolErrorKey = key;
  post({ id: commandId, ok: false, type: "worker-error", error: payload });
}

self.addEventListener("error", (event) => publishWorkerError(event as ErrorEvent));
self.addEventListener("messageerror", (event) => publishWorkerError(event as MessageEvent));
self.addEventListener("unhandledrejection", (event) =>
  publishWorkerError(event as PromiseRejectionEvent),
);

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
  if (!physics || target !== live || epoch !== liveEpoch || ballAuthority) return;
  resetVisualPhysicsToCanonical();
}

async function attachBallAuthority(target: MatchSim, epoch: number) {
  let authority: BallPhysicsAuthority | null;
  try {
    // O import fica dentro do Worker: o WASM não entra no bundle da UI nem
    // bloqueia o primeiro snapshot de uma partida.
    const { createRapierBallAuthority } = await import("./rapier-ball-authority");
    authority = await createRapierBallAuthority();
  } catch {
    authority = null;
  }

  if (!authority) {
    void attachVisualFallback(target, epoch);
    return;
  }
  if (target !== live || epoch !== liveEpoch) {
    authority.dispose();
    return;
  }
  target.setBallPhysicsAuthority(authority);
  if (!target.hasBallPhysicsAuthority()) {
    authority.dispose();
    void attachVisualFallback(target, epoch);
    return;
  }
  ballAuthority = authority;
  latestVisualBall = visualBallFromCanonical(target.physicsBallState());
}

function resetVisualPhysicsToCanonical() {
  if (!live) {
    latestVisualBall = undefined;
    return;
  }
  const canonical = live.physicsBallState();
  if (ballAuthority && live.hasBallPhysicsAuthority()) {
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
  sequence += 1;
  const snapshot = snapshotMatchPacket(live, sequence, {
    pool: snapshotPool,
    rosterVersion,
    includeMetadata: publishedRosterVersion !== rosterVersion,
    ...(latestVisualBall ? { visualBall: latestVisualBall } : {}),
  });
  publishedRosterVersion = rosterVersion;
  post({
    id: commandId,
    ok: true,
    type: "snapshot",
    snapshot,
  }, [snapshot.players.positions, snapshot.players.velocities, snapshot.players.states]);
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
  const after = live.physicsBallState();
  if (ballAuthority && live.hasBallPhysicsAuthority()) {
    latestVisualBall = visualBallFromCanonical(after);
    return;
  }
  if (ballAuthority) {
    ballAuthority = null;
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
    const motionScale = Math.min(speed, MAX_LIVE_MOTION_SCALE);
    advanceLive(fixed * motionScale, (LIVE_MATCH_CLOCK_SCALE * speed) / motionScale);
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
  ballAuthority = null;
  clearVisualPhysics();
  live = new MatchSim(message.home, message.away, message.seed, {
    knockout: message.knockout,
    weather: message.weather,
  });
  paused = false;
  speed = 1;
  sequence = 0;
  rosterVersion = 1;
  publishedRosterVersion = 0;
  const target = live;
  const epoch = ++liveEpoch;
  // A partida começa imediatamente; Rapier se conecta quando o WASM estiver
  // pronto e o fallback visual só é criado se essa inicialização falhar.
  void attachBallAuthority(target, epoch);
  void loadPassLaneKernel().then((kernel) => {
    if (kernel && live === target && liveEpoch === epoch) target.setPassLaneKernel(kernel);
  });
  publishSnapshot();
  ensureTimer();
  post({ id: message.id, ok: true, type: "ready" });
}

async function handleMessage(message: LiveWorkerRequest) {
  commandId = message.id;
  if (message.type === "startLive") {
    await startLive(message);
    return;
  }
  if (message.type === "pauseLive") {
    paused = message.paused;
    if (paused) stopTimer();
    else ensureTimer();
    post({ id: message.id, ok: true, type: "command" });
    return;
  }
  if (message.type === "speedLive") {
    speed = Math.max(1, Math.min(8, message.speed));
    post({ id: message.id, ok: true, type: "command" });
    return;
  }
  if (message.type === "tacticsLive" && live) {
    const setup = message.side === "home" ? live.home : live.away;
    setup.tactics = { ...message.tactics };
    publishSnapshot();
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
    if (changed) {
      rosterVersion += 1;
      resetVisualPhysicsToCanonical();
    }
    publishSnapshot();
    post({ id: message.id, ok: true, type: "command", result: changed });
    return;
  }
  if (message.type === "recycle") {
    snapshotPool.release({
      positions: new Float32Array(message.positions),
      velocities: new Float32Array(message.velocities),
      states: new Float32Array(message.states),
    });
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
      while (!live.finished && guard++ < end)
        live.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE, false);
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
    ballAuthority = null;
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
    let guard = 0;
    while (!sim.finished && guard++ < MATCH_SIMULATION_TICK_LIMIT)
      sim.step(MATCH_SIMULATION_STEP, LIVE_MATCH_CLOCK_SCALE);
    post({ id: message.id, ok: true, result: resultMatch(sim, 1) });
    return;
  }
  if (message.type === "advance") {
    const { advanceRound } = await import("./career");
    const career = advanceRound(message.career, message.result, message.performances);
    post({ id: message.id, ok: true, result: career });
    return;
  }
  if (message.type === "autoSeason") {
    const { autoSeason } = await import("./autoplay");
    post({ id: message.id, ok: true, result: autoSeason(message.career, message.maxWeeks) });
    return;
  }
  throw new Error("Comando de simulação inválido");
}

self.onmessage = (event: MessageEvent<LiveWorkerRequest>) => {
  const message = event.data;
  // `startLive` aguarda o WASM. A fila evita que pause, velocidade ou troca
  // de atleta ultrapassem essa inicialização e produzam snapshots fora de ordem.
  commandQueue = commandQueue
    .then(() => handleMessage(message))
    .catch((error) => {
      post({
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
};
