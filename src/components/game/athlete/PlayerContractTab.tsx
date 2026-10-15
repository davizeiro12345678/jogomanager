import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { acceptOffer, declineOffer, MAX_OFFER_NEGOTIATIONS, negotiateOffer, retire } from "@/game/player-career/engine";
import type { PlayerCareerState } from "@/game/player-career/types";

const money = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

export function ContractTab({
  state,
  commit,
}: {
  state: PlayerCareerState;
  commit: (s: PlayerCareerState) => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="athlete-grid">
      <section className="athlete-card grid gap-2">
        <h2 className="font-bold">Contrato atual</h2>
        <p>{CLUBS[state.contract.clubId]?.name}</p>
        <p className="athlete-meta">
          Salário {money(state.contract.salary)}/semana · bônus por gol{" "}
          {money(state.contract.goalBonus)}
        </p>
        <p className="athlete-meta">
          Até a temporada {state.contract.untilSeason} · multa {money(state.contract.releaseClause)}
        </p>
        <p className="athlete-meta">
          Patrimônio {money(state.money)} · {state.followers.toLocaleString("pt-BR")} seguidores ·
          reputação {Math.round(state.reputation)}
        </p>
        {!state.retired && state.age >= 30 && (
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm("Encerrar a carreira agora?")) commit(retire(state));
            }}
          >
            Anunciar aposentadoria
          </Button>
        )}
      </section>
      <section className="athlete-card grid gap-3">
        <h2 className="font-bold">Propostas</h2>
        {msg && (
          <p role="status" className="athlete-meta">
            {msg}
          </p>
        )}
        {!state.offers.length ? (
          <p className="athlete-meta">
            Nenhuma proposta agora. A janela abre no meio e no fim da temporada.
          </p>
        ) : (
          state.offers.map((o) => {
            const c = CLUBS[o.clubId];
            return (
              <div key={o.id} className="athlete-moment">
                <div className="flex items-center gap-2">
                  {c && <Crest club={c} size={32} />}
                  <strong>{c?.name ?? o.clubId}</strong>
                  <span className="athlete-meta ml-auto">nível {c?.strength}</span>
                </div>
                <p className="athlete-meta">
                  {o.loan ? "Empréstimo" : "Contrato"} de {o.years} temporada(s) · {money(o.salary)}
                  /semana
                </p>
                <p className="athlete-meta">
                  Contrapropostas utilizadas: {o.negotiationRounds ?? 0}/{MAX_OFFER_NEGOTIATIONS}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => commit(acceptOffer(state, o.id))}>
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(o.negotiationRounds ?? 0) >= MAX_OFFER_NEGOTIATIONS}
                    onClick={() => {
                      const r = negotiateOffer(state, o.id);
                      commit(r.state);
                      setMsg(
                        r.accepted
                          ? "Proposta melhorada em 15%."
                          : "O clube desistiu da negociação.",
                      );
                    }}
                  >
                    Pedir +15%
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => commit(declineOffer(state, o.id))}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
