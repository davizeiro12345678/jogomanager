import { useMemo, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeagueStandings } from "@/components/game/LeagueStandings";
import { computeTable } from "@/game/season";
import type { CareerState } from "@/game/types";

/**
 * Tabela de classificação completa dentro da carreira. Fica recolhida por
 * padrão e só monta a grade pesada (busca, zonas, expansão por clube) quando
 * o treinador abre a seção, preservando a primeira pintura no celular.
 */
export function CoachLeagueTable({ career }: { career: CareerState }) {
  const [open, setOpen] = useState(false);
  const myPosition = useMemo(() => {
    if (open) return 0; // a tabela completa já destaca o clube
    const table = computeTable(career);
    return table.findIndex((row) => row.clubId === career.clubId) + 1;
  }, [career, open]);

  return (
    <section id="coach-table" className="coach-office-band" aria-labelledby="coach-table-title">
      <div className="coach-section-heading">
        <h2 id="coach-table-title">Classificação da liga</h2>
        <Button
          variant="outline"
          aria-expanded={open}
          aria-controls="coach-table-body"
          onClick={() => setOpen((value) => !value)}
        >
          <Table2 size={16} aria-hidden="true" />
          {open ? "Recolher tabela" : "Ver tabela completa"}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={open ? "rotate-180 transition-transform" : "transition-transform"}
          />
        </Button>
      </div>
      {!open ? (
        <p className="text-muted-foreground">
          {myPosition > 0
            ? `Seu clube é o ${myPosition}º colocado. Abra a tabela para ver pontos, forma, zonas de acesso e rebaixamento.`
            : "Abra a tabela para acompanhar pontos, forma e zonas da liga."}
        </p>
      ) : (
        <div id="coach-table-body">
          <CoachLeagueTableBody career={career} />
        </div>
      )}
    </section>
  );
}

/** Montada apenas quando a seção está aberta; o cálculo pesado fica aqui. */
function CoachLeagueTableBody({ career }: { career: CareerState }) {
  const table = useMemo(() => computeTable(career), [career]);
  return <LeagueStandings career={career} table={table} />;
}
