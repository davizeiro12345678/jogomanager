import { createRoot } from "react-dom/client";
import PlayerStudio from "../src/components/game/players/PlayerStudio";
import { StudioShell } from "../src/components/game/cinematic/StudioShell";
import "../src/styles.css";

// The product's actual player renderer and controls, without authentication
// or a career save. Served alongside the existing graphics fixture.
createRoot(document.getElementById("root")!).render(
  <StudioShell current="players">
    <PlayerStudio />
  </StudioShell>,
);
