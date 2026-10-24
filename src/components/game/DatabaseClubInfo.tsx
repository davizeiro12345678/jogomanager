import { useQuery } from "@tanstack/react-query";
import { getClubDatabaseProfile } from "@/lib/club-database.functions";

export function DatabaseClubInfo({ clubId }: { clubId: string }) {
  const query = useQuery({
    queryKey: ["club-database", clubId],
    queryFn: () => getClubDatabaseProfile({ data: { clubId } }),
    staleTime: 5 * 60_000,
  });
  if (query.isPending)
    return (
      <p className="text-xs text-muted-foreground" role="status">
        Carregando identidade e resultados oficiais…
      </p>
    );
  if (query.isError)
    return (
      <p className="text-xs text-muted-foreground">
        A base oficial está indisponível neste momento.
      </p>
    );
  const data = query.data;
  if (!data) return null;
  return (
    <section
      className="min-w-0 rounded-xl border border-border/60 surface-card p-4 lg:col-span-3"
      aria-label={`Base oficial de ${data.name}`}
    >
      <div className="flex items-center gap-3">
        {data.crest && (
          <img
            src={data.crest}
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="h-12 w-12 object-contain"
            alt={`Escudo oficial de ${data.name}`}
          />
        )}
        <div>
          <h3 className="font-display text-sm">Identidade e partidas oficiais</h3>
          <p className="text-xs text-muted-foreground">
            {[data.city, data.country, data.founded ? `Fundado em ${data.founded}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {data.stadium && (
        <div className="mt-3 flex items-center gap-3">
          {data.stadium.photo && (
            <img
              src={data.stadium.photo}
              width={96}
              height={64}
              loading="lazy"
              decoding="async"
              className="h-16 w-24 rounded-md object-cover"
              alt={data.stadium.name}
            />
          )}
          <p className="text-sm">
            {data.stadium.name}
            {data.stadium.capacity
              ? ` · ${data.stadium.capacity.toLocaleString("pt-BR")} lugares`
              : ""}
          </p>
        </div>
      )}
      {data.players.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground">Atletas na base oficial</h4>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.players.map((player) => (
              <li key={player.id} className="flex items-center gap-2 rounded-md bg-muted/20 p-2">
                {player.photo && (
                  <img
                    src={player.photo}
                    width={32}
                    height={40}
                    className="h-10 w-8 object-contain"
                    loading="lazy"
                    decoding="async"
                    alt=""
                  />
                )}
                <span className="min-w-0 text-xs">
                  <span className="block truncate">{player.name}</span>
                  <span className="text-muted-foreground">
                    {player.position} · {player.nationality ?? "Futebol"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.matches.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="mb-2 text-left text-muted-foreground">
              Resultados do mundo real · sem alterar a sua carreira
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-2">
                  Data
                </th>
                <th scope="col">Mandante</th>
                <th scope="col">Placar</th>
                <th scope="col">Visitante</th>
              </tr>
            </thead>
            <tbody>
              {data.matches.map((match) => (
                <tr key={match.source_id} className="border-t border-border/40">
                  <td className="whitespace-nowrap py-2">
                    {match.starts_at
                      ? new Date(match.starts_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })
                      : "—"}
                  </td>
                  <td>{match.home_team_name}</td>
                  <td className="whitespace-nowrap px-2 font-semibold">
                    {match.home_score ?? "—"} × {match.away_score ?? "—"}
                  </td>
                  <td>{match.away_team_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
