import { Flag, ShieldCheck, Trophy } from "lucide-react";
import type { PlayerCareerState } from "@/game/player-career/types";
import { Stat } from "./PlayerStats";

export function NationalTeamTab({ state }: { state: PlayerCareerState }) {
  const isInternational = state.nationalCaps > 0;
  const reputationGap = Math.max(0, 36 - Math.round(state.reputation));
  const formGap = Math.max(0, 71 - Math.round(state.form));
  return (
    <div className="athlete-grid athlete-national-grid">
      <section className="athlete-card athlete-national-callup">
        <div className="athlete-national-mark">
          <Flag aria-hidden />
        </div>
        <div>
          <p className="athlete-eyebrow">Carreira internacional</p>
          <h2>{state.nation}</h2>
          <p className="athlete-meta">
            {isInternational
              ? "Você já vestiu a camisa da seleção principal."
              : "Seu desempenho está sendo acompanhado pela comissão técnica."}
          </p>
        </div>
      </section>
      <section className="athlete-card athlete-national-stats">
        <Stat label="Jogos" value={state.nationalCaps} />
        <Stat label="Gols" value={state.nationalGoals} />
        <Stat label="Reputação" value={Math.round(state.reputation)} />
      </section>
      <section className="athlete-card athlete-selection-path">
        <div className="athlete-section-heading">
          <div>
            <p className="athlete-eyebrow">Caminho da convocação</p>
            <h2 className="font-bold">Status atual</h2>
          </div>
          <ShieldCheck aria-hidden />
        </div>
        <div className="athlete-selection-step" data-complete={state.reputation >= 36}>
          <span>01</span>
          <div>
            <strong>Reconhecimento nacional</strong>
            <p className="athlete-meta">
              {reputationGap
                ? `Faltam ${reputationGap} pontos de reputação.`
                : "Patamar alcançado."}
            </p>
          </div>
        </div>
        <div className="athlete-selection-step" data-complete={state.form >= 71}>
          <span>02</span>
          <div>
            <strong>Boa fase</strong>
            <p className="athlete-meta">
              {formGap ? `Eleve a forma em ${formGap} pontos.` : "Forma de convocação."}
            </p>
          </div>
        </div>
        <div className="athlete-selection-step" data-complete={isInternational}>
          <span>03</span>
          <div>
            <strong>Convocação</strong>
            <p className="athlete-meta">
              {isInternational
                ? `${state.nationalCaps} partida(s) pela seleção.`
                : "Pode acontecer ao avançar uma semana em grande fase."}
            </p>
          </div>
        </div>
      </section>
      <section className="athlete-card athlete-national-honours">
        <Trophy aria-hidden />
        <div>
          <h2 className="font-bold">Legado internacional</h2>
          <p className="athlete-meta">
            {state.nationalGoals > 0
              ? `${state.nationalGoals} gol(s) marcados pelo seu país.`
              : "A primeira convocação abre a corrida por recordes e títulos."}
          </p>
        </div>
      </section>
    </div>
  );
}
