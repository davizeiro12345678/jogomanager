import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Stadium3D } from "../src/components/game/Stadium3D";
import { benchmarkTeam } from "./graphics-fixture";
import { CAMERA_OPTIONS, type CameraMode } from "../src/game/camera-modes";
import { WorkerMatchView } from "../src/game/live-match";
import { DEFAULT_VISUAL } from "../src/game/visual-settings";

// Dedicated origin and explicit settings; no career saves or authentication.
// Use the store's existing public persistence contract, before first render.
const settingsKey = "manager3d.visual.v2";
localStorage.setItem(settingsKey, JSON.stringify({ ...DEFAULT_VISUAL, quality: "alta", adaptive: false, showFps: false, time: "dia", mow: "stripes", resolutionScale: 1 }));
function initialCameraMode(): CameraMode {
  const requested = new URLSearchParams(location.search).get("camera");
  return CAMERA_OPTIONS.some((option) => option.id === requested)
    ? (requested as CameraMode)
    : "tactical";
}

function Benchmark() {
  const [controller, setController] = useState<{ view: WorkerMatchView; isWorker: boolean } | null>(null);
  const [sample, setSample] = useState<Record<string, unknown>>({ status: "Aquecendo 5 s; medindo 60 s" });
  const [mode, setMode] = useState<CameraMode>(initialCameraMode);
  const [run, setRun] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const manual = new URLSearchParams(location.search).get("manual") === "1";
  useEffect(() => {
    const view = new WorkerMatchView(benchmarkTeam("fla"), benchmarkTeam("pal"));
    const worker = new Worker(new URL("./graphics-fixture.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.postMessage({ type: "manual", manual });
    let started = false;
    worker.onmessage = event => { view.apply(event.data); if (!started) { started = true; setController({ view, isWorker: true }); } };
    return () => { workerRef.current = null; worker.terminate(); };
  }, [manual, run]);
  useEffect(() => {
    const read = (event: Event) => setSample((event as CustomEvent<Record<string, unknown>>).detail);
    window.addEventListener("graphics-sample", read);
    return () => window.removeEventListener("graphics-sample", read);
  }, []);
  useEffect(() => {
    const bridge = window as Window & { render_game_to_text?: () => string; advanceTime?: (ms: number) => Promise<void> };
    const priorAdvance = bridge.advanceTime;
    const priorText = bridge.render_game_to_text;
    bridge.advanceTime = async (ms) => {
      if (manual) workerRef.current?.postMessage({ type: "advance", ms });
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    };
    bridge.render_game_to_text = () => JSON.stringify({
      scenario: "Flamengo x Palmeiras / graphics-high-v1",
      mode,
      worker: Boolean(controller?.isWorker),
      simulation: controller ? {
        minute: controller.view.minute(),
        ball: { x: Number(controller.view.ball.x.toFixed(2)), z: Number(controller.view.ball.z.toFixed(2)), height: Number(controller.view.ball.height.toFixed(2)) },
        score: [controller.view.stats.home.goals, controller.view.stats.away.goals],
        possession: controller.view.possession,
      } : null,
      metrics: sample,
    });
    return () => {
      bridge.advanceTime = priorAdvance;
      bridge.render_game_to_text = priorText;
    };
  }, [controller, manual, mode, sample]);
  const selectedCamera = CAMERA_OPTIONS.find((option) => option.id === mode)!;
  return <main>
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 12 }}>
      <strong>ALTO • Flamengo × Palmeiras • seed graphics-high-v1</strong>
      <select aria-label="Câmera" value={mode} onChange={e => setMode(e.target.value as CameraMode)}>
        {CAMERA_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.id === "tactical" ? `${option.label} fixa (baseline)` : option.label}
          </option>
        ))}
      </select>
      <span title={selectedCamera.description}>{selectedCamera.description}</span>
      <button onClick={() => { setController(null); setRun(value => value + 1); }}>Reentrar / repetir</button>
      <span>Worker: {String(controller?.isWorker ?? false)}</span>
    </div>
    <div style={{ height: 720, width: 1280 }}>{controller && <Stadium3D key={run} sim={controller.view} mode={mode} quality="alta" pixelRatio={1} />}</div>
    <pre id="metrics" style={{ padding: 16 }}>{JSON.stringify(sample, null, 2)}</pre>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Benchmark />);
