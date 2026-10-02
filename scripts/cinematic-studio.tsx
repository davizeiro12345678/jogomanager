import { createRoot } from "react-dom/client";
import CinematicStudio from "../src/components/game/cinematic/CinematicStudio";
import { StudioShell } from "../src/components/game/cinematic/StudioShell";
import "../src/styles.css";
createRoot(document.getElementById("root")!).render(
  <StudioShell current="cinema">
    <CinematicStudio />
  </StudioShell>,
);
