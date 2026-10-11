import { useQuery } from "@tanstack/react-query";
import { getClubReal } from "@/lib/real-football.functions";

/** Real-world coach and injury list for a club, from imported match data. */
export function RealClubInfo({ name }: { name: string }) {
  const q = useQuery({
    queryKey: ["club-real", name],
    queryFn: () => getClubReal({ data: { name } }),
    staleTime: 30 * 60_000,
  });
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Carregando dados reais de {name}…</p>;
  if (q.isError) return <p className="text-xs text-muted-foreground">Dados reais indisponíveis agora.</p>;
  const d = q.data;
  if (!d || (!d.coach && d.injuries.length === 0 && d.transfers.length === 0)) return null;
  return (
    <section className="rounded-xl border border-border/60 surface-card p-4 text-sm" aria-label={`Dados reais de ${name}`}>
      <h3 className="font-display text-xs uppercase tracking-[0.25em] text-primary">No mundo real · {name}</h3>
      {d.coach && (
        <p className="mt-2 text-muted-foreground">
          Técnico: <strong className="text-foreground">{d.coach.name}</strong>
          {d.coach.nationality ? ` (${d.coach.nationality}` : ""}
          {d.coach.age ? `, ${d.coach.age} anos)` : d.coach.nationality ? ")" : ""}
        </p>
      )}
      {d.injuries.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {d.injuries.map((i) => (
            <li key={i.player} className="flex justify-between gap-3">
              <span>{i.player}</span>
              <span className="text-xs text-muted-foreground">{i.reason || i.type}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Sem desfalques registrados recentemente.</p>
      )}
      {d.transfers.length > 0 && (
        <>
          <h4 className="mt-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">Últimas transferências</h4>
          <ul className="mt-2 space-y-1">
            {d.transfers.map((t) => (
              <li key={t.player + t.date} className="flex justify-between gap-3">
                <span>
                  <span className={t.direction === "in" ? "text-primary" : "text-muted-foreground"}>{t.direction === "in" ? "Chegou" : "Saiu"}</span>{" "}
                  {t.player}
                  {t.other ? <span className="text-xs text-muted-foreground"> · {t.direction === "in" ? "de" : "para"} {t.other}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(t.date).getFullYear()}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
