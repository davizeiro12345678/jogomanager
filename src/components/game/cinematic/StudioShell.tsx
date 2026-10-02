import type { ReactNode } from "react";
import { Clapperboard, UserRound } from "lucide-react";
import "./studio.css";

export function StudioShell({
  current,
  children,
}: {
  current: "players" | "cinema";
  children: ReactNode;
}) {
  return (
    <main className="studio-page">
      <div className="studio-shell">
        <nav className="studio-nav" aria-label="Estúdios visuais">
          <span className="studio-brand">
            JOGOMANAGER <span className="text-primary">/</span> STUDIO
          </span>
          <a href="/player-studio.html" aria-current={current === "players" ? "page" : undefined}>
            <UserRound size={15} />
            Jogadores
          </a>
          <a href="/cinematic-studio.html" aria-current={current === "cinema" ? "page" : undefined}>
            <Clapperboard size={15} />
            Cinema
          </a>
        </nav>
        <h1 className="sr-only">
          {current === "players" ? "Estúdio de jogadores" : "Cinema da carreira"}
        </h1>
        {children}
      </div>
    </main>
  );
}
