import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Tab } from "./player-tabs";
import type { PlayerCareerState } from "@/game/player-career/types";
import { playerGuideProgress } from "@/game/player-career/guide-progress";

/** Contextual guidance stays outside the athlete render and simulation loops. */
export function PlayerCareerGuide({
  state,
  onOpenTab,
}: {
  state: PlayerCareerState;
  onOpenTab: (tab: Tab) => void;
}) {
  const progress = playerGuideProgress(state);
  return (
    <details className="athlete-card mt-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
        <BookOpen size={18} aria-hidden />
        Tutorial da carreira de jogador
      </summary>
      <p className="athlete-meta mt-3" role="status">
        {progress.completed} de {progress.total} primeiros passos concluídos na carreira
      </p>
      <ol className="mt-3 grid gap-4 sm:grid-cols-2">
        <li>
          <h2 className="font-semibold">
            1. Prepare a semana{progress.weekPlayed ? " — Concluída" : ""}
          </h2>
          <p className="athlete-meta mt-1">
            Escolha duas áreas de treino na aba Semana. Compare a energia prevista e o risco de
            lesão antes de avançar.
          </p>
        </li>
        <li>
          <h2 className="font-semibold">
            2. Faça suas escolhas em campo{progress.appeared ? " — Participação registrada" : ""}
          </h2>
          <p className="athlete-meta mt-1">
            Use “Decidir meus lances” para escolher o risco de cada jogada. Depois, jogue a semana e
            confira sua nota no relatório.
          </p>
        </li>
        <li>
          <h2 className="font-semibold">3. Acompanhe sua evolução</h2>
          <p className="athlete-meta mt-1">
            Confira os objetivos da temporada e os atributos.{" "}
            {state.injury
              ? "Você está lesionado: priorize a recuperação na aba Saúde."
              : "Preserve energia para ganhar minutos e confiança do treinador."}
          </p>
        </li>
        <li>
          <h2 className="font-semibold">4. Planeje o próximo contrato</h2>
          <p className="athlete-meta mt-1">
            Abra Contrato e propostas para comparar salário, duração e oportunidades. Histórico e
            Calendário ajudam a avaliar sua trajetória.
          </p>
        </li>
        <li>
          <h2 className="font-semibold">5. Planeje jogos e recuperação</h2>
          <p className="athlete-meta mt-1">
            Compare o calendário com seu risco de lesão. Se houver jogos próximos, reduza o esforço
            no treino e confira a evolução na aba Saúde.
          </p>
        </li>
        <li>
          <h2 className="font-semibold">6. Revise a temporada</h2>
          <p className="athlete-meta mt-1">
            Use o Histórico para comparar partidas, notas e participação entre temporadas. Escolha
            um atributo para priorizar com base no seu papel em campo.
          </p>
        </li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        {!state.retired && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onOpenTab("semana")}
          >
            Abrir Semana
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onOpenTab("saude")}
        >
          Abrir Saúde
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onOpenTab("historico")}
        >
          Abrir Histórico
        </Button>
      </div>
    </details>
  );
}
