import { Crest } from "@/components/game/Crest";
import { ScreenHeader } from "@/components/game/screen-kit";
import { CLUBS } from "@/game/data/leagues";
import { summarizeAthleteCareer, summarizeCoachCareer } from "@/game/career-hub";
import { ATHLETE_SLOTS } from "@/lib/player-career-store";
import { useAthleteSlots } from "@/hooks/useAthlete";
import { useCareer } from "@/hooks/useCareer";
import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Cloud,
  CloudOff,
  Plus,
  Trophy,
  UserRound,
} from "lucide-react";

import "@/components/game/athlete.css";

export const Route = createFileRoute("/carreiras")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Minhas carreiras · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Retome suas carreiras de treinador e jogador neste aparelho.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: CareersHub,
});

function syncLabel(sync: ReturnType<typeof useCareer>["sync"], signedIn: boolean | null) {
  if (signedIn === false) return { Icon: CloudOff, label: "Salvo neste aparelho" };
  if (sync === "synced") return { Icon: Cloud, label: "Sincronizado com sua conta" };
  if (sync === "offline") return { Icon: CloudOff, label: "Sem conexão: salvo neste aparelho" };
  if (sync === "pending") return { Icon: CloudOff, label: "Alterações aguardando sincronização" };
  if (sync === "syncing") return { Icon: Cloud, label: "Sincronizando suas carreiras" };
  return { Icon: CloudOff, label: "Preparando seus saves locais" };
}

function CareersHub() {
  const { career, isLoading, signedIn, sync } = useCareer();
  const { slots, error: athleteError } = useAthleteSlots();
  const coach = summarizeCoachCareer(career);
  const coachClub = career ? CLUBS[career.clubId] : undefined;
  const syncState = syncLabel(sync, signedIn);
  const SyncIcon = syncState.Icon;
  const ready = !isLoading && slots !== null;

  return (
    <main className="athlete-shell career-hub-shell">
      <div className="athlete-wrap career-hub-wrap">
        <div className="athlete-top">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Início
            </Link>
          </Button>
          <span className="athlete-meta career-hub-sync" role="status">
            <SyncIcon className="size-4" aria-hidden="true" /> {syncState.label}
          </span>
        </div>

        <header className="career-hub-heading">
          <p className="career-hub-kicker">SEU ARQUIVO DE HISTÓRIAS</p>
          <ScreenHeader title="Minhas carreiras" />
          <p className="athlete-meta">
            Treinador e atletas vivem em saves separados. Escolha uma história para retomar sem
            substituir nenhuma outra.
          </p>
        </header>

        {athleteError ? (
          <p className="athlete-card athlete-meta" role="alert">
            {athleteError}
          </p>
        ) : null}

        {!ready ? (
          <section className="athlete-card career-hub-loading" aria-busy="true">
            Carregando suas carreiras…
          </section>
        ) : (
          <>
            <section aria-labelledby="coach-career-heading" className="career-hub-section">
              <div className="career-hub-section-heading">
                <div>
                  <p className="career-hub-kicker">BANCO DE RESERVAS</p>
                  <h2 id="coach-career-heading">Carreira de treinador</h2>
                </div>
                <Briefcase className="size-5" aria-hidden="true" />
              </div>

              {coach ? (
                <article
                  className="athlete-card career-hub-coach"
                  style={{ ["--club" as string]: coach.accent }}
                >
                  <div className="career-hub-emblem" aria-hidden="true">
                    {coachClub ? <Crest club={coachClub} size={58} /> : <Briefcase />}
                  </div>
                  <div className="min-w-0">
                    <p className="career-hub-card-label">TREINADOR</p>
                    <h3>{coach.managerName}</h3>
                    <p className="career-hub-club">{coach.status}</p>
                    <p className="athlete-meta">
                      Temporada {coach.season} · rodada {coach.round}
                    </p>
                  </div>
                  <div className="career-hub-card-actions">
                    <Button asChild>
                      <Link to={coach.active ? "/dashboard" : "/carreira"}>
                        {coach.active ? "Continuar no clube" : "Ver propostas"}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <span className="career-hub-club-name">{coach.clubName}</span>
                  </div>
                </article>
              ) : (
                <article className="athlete-card career-hub-empty">
                  <div className="career-hub-empty-icon" aria-hidden="true">
                    <Trophy className="size-6" />
                  </div>
                  <div>
                    <h3>Seu banco está livre</h3>
                    <p className="athlete-meta">
                      Escolha um clube existente ou dê identidade a um clube criado por você.
                    </p>
                  </div>
                  <div className="career-hub-card-actions">
                    <Button asChild>
                      <Link to="/new">
                        Assumir um clube <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/clube/novo">Criar meu clube</Link>
                    </Button>
                  </div>
                </article>
              )}
            </section>

            <section aria-labelledby="athlete-careers-heading" className="career-hub-section">
              <div className="career-hub-section-heading">
                <div>
                  <p className="career-hub-kicker">DO CAMPO À HISTÓRIA</p>
                  <h2 id="athlete-careers-heading">Carreiras de jogador</h2>
                </div>
                <UserRound className="size-5" aria-hidden="true" />
              </div>

              <div className="career-hub-athletes">
                {ATHLETE_SLOTS.map((slot) => {
                  const athlete = summarizeAthleteCareer(slots[slot - 1] ?? null, slot);
                  if (!athlete)
                    return (
                      <article
                        key={slot}
                        className="athlete-card career-hub-athlete career-hub-empty"
                      >
                        <div className="career-hub-slot">{slot}</div>
                        <div>
                          <p className="career-hub-card-label">ESPAÇO DE ATLETA</p>
                          <h3>Nova história</h3>
                          <p className="athlete-meta">
                            Crie identidade, posição, aparência e primeiro clube.
                          </p>
                        </div>
                        <Button asChild variant="outline">
                          <Link to="/jogador/novo" search={{ slot }}>
                            <Plus className="size-4" /> Criar atleta
                          </Link>
                        </Button>
                      </article>
                    );

                  const club = CLUBS[slots[slot - 1]!.clubId];
                  return (
                    <article
                      key={slot}
                      className="athlete-card career-hub-athlete"
                      style={{ ["--club" as string]: athlete.accent }}
                    >
                      <div className="career-hub-athlete-top">
                        <span className="career-hub-slot">{slot}</span>
                        {club ? <Crest club={club} size={36} /> : null}
                        <span className="athlete-ovr" aria-label={`Overall ${athlete.rating}`}>
                          {athlete.rating}
                        </span>
                      </div>
                      <div>
                        <p className="career-hub-card-label">
                          {athlete.retired ? "LEGADO" : "ATLETA"}
                        </p>
                        <h3>{athlete.athleteName}</h3>
                        <p className="career-hub-club">
                          {athlete.retired ? "Carreira encerrada" : athlete.clubName}
                        </p>
                        <p className="athlete-meta">
                          {athlete.position} · {athlete.age} anos · temporada {athlete.season} ·
                          semana {athlete.week}
                        </p>
                      </div>
                      <Button asChild className="w-full">
                        <Link to="/jogador/painel" search={{ slot }}>
                          {athlete.retired ? "Ver legado" : "Continuar atleta"}
                          <ArrowRight className="size-4" />
                        </Link>
                      </Button>
                    </article>
                  );
                })}
              </div>
              <div className="career-hub-athlete-footer">
                <span className="athlete-meta">Quer organizar ou remover um atleta salvo?</span>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/jogador">Gerenciar atletas</Link>
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
