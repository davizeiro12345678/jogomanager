import { createRoot } from "react-dom/client";
import PlayerStudio from "../src/components/game/players/PlayerStudio";
import "../src/styles.css";

// The product's actual player renderer and controls, without authentication
// or a career save. Served alongside the existing graphics fixture.
createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px" }}>
    <p className="text-xs uppercase tracking-widest text-muted-foreground">JogoManager</p>
    <h1 className="mt-2 font-display text-2xl uppercase">Estúdio de jogadores</h1>
    <PlayerStudio />
  </main>,
);
