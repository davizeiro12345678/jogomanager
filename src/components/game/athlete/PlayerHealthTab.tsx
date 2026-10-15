import { trainingOutlook } from "@/game/player-career/engine";
import type { PlayerCareerState, TrainingIntensity } from "@/game/player-career/types";

const INTENSITIES: { value: TrainingIntensity; label: string }[] = [
  { value: "leve", label: "Leve" },
  { value: "normal", label: "Normal" },
  { value: "pesado", label: "Pesado" },
];

export function PlayerHealthTab({ state }: { state: PlayerCareerState }) {
  return (
    <div className="grid gap-4">
      <section className="athlete-card">
        <h2 className="text-lg font-bold">Condição e recuperação</h2>
        <p className="athlete-meta mt-2">Energia: {Math.round(state.energy)}%</p>
        <p className="athlete-meta">Forma: {Math.round(state.form)}%</p>
        <p className="athlete-meta">Moral: {Math.round(state.morale)}%</p>
        {state.injury ? (
          <p role="status" className="mt-3">
            {state.injury.label} · recuperação estimada: {state.injury.weeksLeft} semanas.
          </p>
        ) : (
          <p className="athlete-meta mt-3">Nenhuma lesão ativa.</p>
        )}
      </section>
      <section className="athlete-card">
        <h2 className="text-lg font-bold">Comparar intensidade do treino</h2>
        <p className="athlete-meta mt-1">
          Projeções calculadas pelo motor da carreira, antes da simulação da semana.
        </p>
        <div className="grid gap-3 mt-4 sm:grid-cols-3">
          {INTENSITIES.map((intensity) => {
            const outlook = trainingOutlook(state, intensity.value);
            return (
              <article className="athlete-moment" key={intensity.value}>
                <h3 className="font-bold">{intensity.label}</h3>
                <p className="athlete-meta mt-1">
                  Energia estimada: {Math.round(outlook.energyAfter)}%
                </p>
                <p className="athlete-meta">
                  Risco de lesão: {(outlook.injuryRisk * 100).toFixed(1)}%
                </p>
              </article>
            );
          })}
        </div>
        <p className="athlete-meta mt-3">
          Escolha o treino efetivo na aba Semana. Treinar pesado oferece mais evolução
          potencial, mas exige atenção à recuperação.
        </p>
      </section>
    </div>
  );
}
