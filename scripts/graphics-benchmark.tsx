import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Stadium3D, type Quality } from "../src/components/game/Stadium3D";
import { benchmarkTeam } from "./graphics-fixture";
import { CAMERA_OPTIONS, type CameraMode } from "../src/game/camera-modes";
import { WorkerMatchView } from "../src/game/live-match";
import { DEFAULT_VISUAL } from "../src/game/visual-settings";
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
    time: benchmark.time,
    weather: benchmark.weather,
    mow: benchmark.mow,
    resolutionScale: 1,
  }),
);
setBenchmarkMetadata(benchmark.camera);

function Benchmark() {
  const [controller, setController] = useState<{ view: WorkerMatchView; isWorker: boolean } | null>(
    null,
  );
  const [sample, setSample] = useState<Record<string, unknown>>({
    status: `Aquecendo ${measurementTiming.warmupMs / 1000} s; medindo ${measurementTiming.measurementMs / 1000} s`,
  });
  const [mode, setMode] = useState<CameraMode>(benchmark.camera);
  const [run, setRun] = useState(0);
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
            setRun((value) => value + 1);
          }}
        >
          Reentrar / repetir
        </button>
        <span>Worker: {String(controller?.isWorker ?? false)}</span>
      </div>
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
createRoot(document.getElementById("root")!).render(<Benchmark />);
