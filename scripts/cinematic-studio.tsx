import { createRoot } from "react-dom/client";
import CinematicStudio from "../src/components/game/cinematic/CinematicStudio";
import "../src/styles.css";
createRoot(document.getElementById("root")!).render(
  <main className="mx-auto max-w-6xl px-4 py-10">
    <p className="text-xs uppercase tracking-widest text-primary">JogoManager</p>
    <h1 className="mt-3 font-display text-3xl uppercase">Cinema da carreira</h1>
    <CinematicStudio />
  </main>,
);
