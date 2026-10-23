import React, { useEffect, useRef, useState } from "react";
import { Stadium3D, type Quality } from "../src/components/game/Stadium3D";
import { benchmarkTeam } from "./graphics-fixture";
import { CAMERA_OPTIONS, type CameraMode } from "../src/game/camera-modes";
import { WorkerMatchView } from "../src/game/live-match";
import { DEFAULT_VISUAL } from "../src/game/visual-settings";
import { gpuTextureStats } from "../src/game/textures/ktx2";
import { nativeMeasurementTiming } from "../src/game/native-performance-contract";
import {
  resolveGraphicsBenchmark,
  type GraphicsBenchmarkMetadata,
} from "./graphics-benchmark-contract";

// Dedicated origin and explicit settings; no career saves or authentication.
// Use the store's existing public persistence contract, before first render.
const settingsKey = "manager3d.visual.v3";
const benchmark = resolveGraphicsBenchmark(location.search);
const rendererQuality: Quality = benchmark.quality === "cinema" ? "alta" : benchmark.quality;
const measurementTiming = nativeMeasurementTiming(location.search);

type BenchmarkWindow = Window & {
  __PFM_GRAPHICS_BENCHMARK__?: GraphicsBenchmarkMetadata;
};

interface ManualFixtureState {
  seq: number;
  time: number;
  ball: { x: number; z: number; height: number; vx: number; vy: number; vz: number };
}

function setBenchmarkMetadata(camera: CameraMode) {
  (window as BenchmarkWindow).__PFM_GRAPHICS_BENCHMARK__ = { ...benchmark, camera };
}

localStorage.setItem(
  settingsKey,
  JSON.stringify({
    ...DEFAULT_VISUAL,
    quality: benchmark.quality,
    adaptive: false,
    showFps: false,
    postFx: benchmark.postFx,
    time: benchmark.time,
    weather: benchmark.weather,
    mow: benchmark.mow,
    resolutionScale: 1,
  }),
);
setBenchmarkMetadata(benchmark.camera);

export function Benchmark() {
  const [controller, setController] = useState<{ view: WorkerMatchView; isWorker: boolean } | null>(
    null,
  );
  const [sample, setSample] = useState<Record<string, unknown>>({
    status: `Aquecendo ${measurementTiming.warmupMs / 1000} s; medindo ${measurementTiming.measurementMs / 1000} s`,
  });
  const [mode, setMode] = useState<CameraMode>(benchmark.camera);
  const [run, setRun] = useState(0);
  const [manualFixture, setManualFixture] = useState<ManualFixtureState | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const manual = new URLSearchParams(location.search).get("manual") === "1";
  useEffect(() => {
    const view = new WorkerMatchView(
      benchmarkTeam(benchmark.fixture.homeClubId),
      benchmarkTeam(benchmark.fixture.awayClubId),
    );
    const worker = new Worker(new URL("./graphics-fixture.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.postMessage({ type: "init", manual, seed: benchmark.seed });
    let started = false;
    worker.onmessage = (event) => {
      view.apply(event.data);
      if (manual && event.data.fixture) setManualFixture(event.data.fixture);
      if (!started) {
        started = true;
        setController({ view, isWorker: true });
      }
    };
    return () => {
      workerRef.current = null;
      worker.terminate();
    };
  }, [manual, run]);
  useEffect(() => {
    setBenchmarkMetadata(mode);
  }, [mode]);
  useEffect(() => {
    const read = (event: Event) =>
      setSample((event as CustomEvent<Record<string, unknown>>).detail);
    window.addEventListener("graphics-sample", read);
    return () => window.removeEventListener("graphics-sample", read);
  }, []);
  useEffect(() => {
    const bridge = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => Promise<void>;
    };
    const priorAdvance = bridge.advanceTime;
    const priorText = bridge.render_game_to_text;
    bridge.advanceTime = async (ms) => {
      if (manual) workerRef.current?.postMessage({ type: "advance", ms });
      // A worker message is sufficient to move the deterministic fixture. Do
      // not wait for rAF here: background and headless browser tabs may throttle
      // it indefinitely, which would make the benchmark test harness hang.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    };
    bridge.render_game_to_text = () =>
      JSON.stringify({
        scenario: { ...benchmark, camera: mode },
        mode,
        worker: Boolean(controller?.isWorker),
        simulation: controller
          ? {
              minute: controller.view.minute(),
              ball: {
                x: Number(controller.view.ball.x.toFixed(2)),
                z: Number(controller.view.ball.z.toFixed(2)),
                height: Number(controller.view.ball.height.toFixed(2)),
              },
              score: [controller.view.stats.home.goals, controller.view.stats.away.goals],
              possession: controller.view.possession,
            }
          : null,
        metrics: sample,
        textures: { ...gpuTextureStats },
      });
    return () => {
      if (priorAdvance) bridge.advanceTime = priorAdvance;
      else delete bridge.advanceTime;
      if (priorText) bridge.render_game_to_text = priorText;
      else delete bridge.render_game_to_text;
    };
  }, [controller, manual, mode, sample]);
  const selectedCamera = CAMERA_OPTIONS.find((option) => option.id === mode)!;
  return (
    <main>
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 12 }}>
        <strong>
          {benchmark.quality.toUpperCase()} • {benchmark.fixture.label} • {benchmark.label} • seed{" "}
          {benchmark.seed}
        </strong>
        <select
          aria-label="Câmera"
          value={mode}
          onChange={(e) => setMode(e.target.value as CameraMode)}
        >
          {CAMERA_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.id === "tactical" ? `${option.label} fixa (baseline)` : option.label}
            </option>
          ))}
        </select>
        <span title={selectedCamera.description}>{selectedCamera.description}</span>
        <button
          onClick={() => {
            setController(null);
            setManualFixture(null);
            setRun((value) => value + 1);
          }}
        >
          Reentrar / repetir
        </button>
        <span>Worker: {String(controller?.isWorker ?? false)}</span>
      </div>
      {manual && (
        <section aria-label="Controle da fixture manual" style={{ padding: "0 12px 12px" }}>
          <button
            disabled={!controller}
            onClick={() => workerRef.current?.postMessage({ type: "advance", ms: 1000 })}
          >
            Avançar 1 s
          </button>{" "}
          <button
            disabled={!controller}
            onClick={() => workerRef.current?.postMessage({ type: "advance", ms: 10000 })}
          >
            Avançar 10 s
          </button>
          <output
            id="manual-fixture"
            data-seq={manualFixture?.seq}
            data-time={manualFixture?.time}
            style={{ display: "block", fontFamily: "monospace", whiteSpace: "pre-wrap" }}
          >
            {manualFixture
              ? `seq=${manualFixture.seq} tempo=${manualFixture.time.toFixed(6)} s | bola x=${manualFixture.ball.x.toFixed(6)} y=${manualFixture.ball.height.toFixed(6)} z=${manualFixture.ball.z.toFixed(6)} | vx=${manualFixture.ball.vx.toFixed(6)} vy=${manualFixture.ball.vy.toFixed(6)} vz=${manualFixture.ball.vz.toFixed(6)} | velocidade=${Math.hypot(manualFixture.ball.vx, manualFixture.ball.vy, manualFixture.ball.vz).toFixed(6)} m/s | velocidade horizontal=${Math.hypot(manualFixture.ball.vx, manualFixture.ball.vz).toFixed(6)} m/s`
              : "Aguardando primeira mensagem da fixture"}
          </output>
        </section>
      )}
      <div style={{ width: benchmark.viewport.width, height: benchmark.viewport.height }}>
        {controller && (
          <Stadium3D
            key={run}
            sim={controller.view}
            mode={mode}
            quality={rendererQuality}
            pixelRatio={benchmark.viewport.dpr}
          />
        )}
      </div>
      <pre id="metrics" style={{ padding: 16 }}>
        {JSON.stringify(sample, null, 2)}
      </pre>
    </main>
  );
}
