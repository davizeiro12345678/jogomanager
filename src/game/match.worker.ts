/// <reference lib="webworker" />
import { advanceRound } from "./career";
import { resultMatch, snapshotMatch, type LiveWorkerRequest } from "./live-match";
import { MatchSim } from "./sim";

let live: MatchSim | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let paused = true;
let speed = 1;
let sequence = 0;
let lastTick = 0;
let accumulator = 0;
let commandId = 0;

function post(message: unknown) {
  self.postMessage(message);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
  lastTick = 0;
  accumulator = 0;
}

function publishSnapshot() {
  if (!live) return;
  sequence += 1;
  post({ id: commandId, ok: true, type: "snapshot", snapshot: snapshotMatch(live, sequence) });
}

function publishFinished() {
  if (!live) return;
  sequence += 1;
  post({ id: commandId, ok: true, type: "finished", result: resultMatch(live, sequence) });
  paused = true;
  stopTimer();
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
    live.step(fixed * 6 * speed);
  }
  if (live.finished) publishFinished();
  else publishSnapshot();
}

function ensureTimer() {
  if (!timer) timer = setInterval(tick, 100);
}

self.onmessage = (event: MessageEvent<LiveWorkerRequest>) => {
  const message = event.data;
  commandId = message.id;
  try {
    if (message.type === "startLive") {
      stopTimer();
      live = new MatchSim(message.home, message.away, message.seed);
      paused = false;
      speed = 1;
      sequence = 0;
      publishSnapshot();
      ensureTimer();
      post({ id: message.id, ok: true, type: "ready" });
      return;
    }
    if (message.type === "pauseLive") {
      paused = message.paused;
      lastTick = 0;
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
    if (message.type === "substituteLive" && live) {
      const changed = live.substitute(message.side, message.outPid, message.incoming);
      publishSnapshot();
      post({ id: message.id, ok: true, type: "command", result: changed });
      return;
    }
    if (message.type === "skipLive" && live) {
      let guard = 0;
      while (!live.finished && guard++ < 14_000) live.step(0.4);
      publishFinished();
      return;
    }
    if (message.type === "stopLive") {
      paused = true;
      live = null;
      stopTimer();
      post({ id: message.id, ok: true, type: "command" });
      return;
    }
    if (message.type === "simulate") {
      const sim = new MatchSim(message.home, message.away, message.seed);
      let guard = 0;
      while (!sim.finished && guard++ < 14_000) sim.step(0.4);
      post({ id: message.id, ok: true, result: resultMatch(sim, 1) });
      return;
    }
    if (message.type === "advance") {
      const career = advanceRound(message.career, message.result, message.performances);
      post({ id: message.id, ok: true, result: career });
      return;
    }
    throw new Error("Comando de simulação inválido");
  } catch (error) {
    post({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
