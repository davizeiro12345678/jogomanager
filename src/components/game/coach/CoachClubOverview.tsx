import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { summarizeCoachSquad } from "@/game/coach-office";
import type { CareerState } from "@/game/types";

function CoachMeter({ label, value, tone }: { label: string; value: number; tone: string }) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="coach-meter">
      <div className="coach-meter-label">
        <span>{label}</span>
        <strong>
          {score}
          <small>/100</small>
        </strong>
      </div>
      <meter min={0} max={100} value={score} aria-label={label} style={{ color: tone }} />
    </div>
  );
}

export function CoachClubOverview({
  career,
  squad,
}: {
  career: CareerState;
  squad: ReturnType<typeof summarizeCoachSquad>;
}) {
  return (
    <section id="coach-club" className="coach-office-band" aria-labelledby="coach-club-title">
      <div className="coach-section-heading">
        <h2 id="coach-club-title">Situação do clube</h2>
        <Link to="/board">
          Diretoria <ArrowRight size={16} />
        </Link>
      </div>
      <div className="coach-meters">
        <CoachMeter label="Moral do elenco" value={squad.morale} tone="var(--primary)" />
        <CoachMeter label="Condição física" value={squad.condition} tone="var(--career-focus)" />
        <CoachMeter label="Forma recente" value={squad.form} tone="var(--career-warning)" />
        <CoachMeter label="Diretoria" value={career.approval} tone="var(--career-success)" />
        <CoachMeter label="Torcida" value={career.fanApproval} tone="var(--primary)" />
        <CoachMeter
          label="Pressão · menor é melhor"
          value={career.pressure}
          tone="var(--career-danger)"
        />
      </div>
      <dl className="coach-club-facts">
        <div>
          <dt>Caixa</dt>
          <dd>€ {career.finances.budget.toFixed(1)}M</dd>
        </div>
        <div>
          <dt>Objetivo na liga</dt>
          <dd>{career.objective}º lugar</dd>
        </div>
        <div>
          <dt>Propostas de clubes</dt>
          <dd>
            <Link to="/board">{career.jobOffers.length} disponíveis</Link>
          </dd>
        </div>
      </dl>
    </section>
  );
}
