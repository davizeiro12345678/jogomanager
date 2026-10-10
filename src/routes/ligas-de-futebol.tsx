import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Flag } from "@/components/game/Flag";
import { BUNDLED_LEAGUES } from "@/game/data/leagues";
import { PublicLinks } from "@/components/PublicLinks";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/ligas-de-futebol";
function hasPublicClubName(name: string) {
  const normalized = name.trim().toLocaleLowerCase("pt-BR");
  return normalized.length > 0 && normalized !== "clube";
}

const NAMED_CLUB_COUNT = BUNDLED_LEAGUES.reduce(
  (total, league) => total + league.clubs.filter((club) => hasPublicClubName(club.name)).length,
  0,
);
const TITLE = "Ligas de futebol e clubes disponíveis | JogoManager";
const DESC = `Explore ${BUNDLED_LEAGUES.length} ligas e ${NAMED_CLUB_COUNT} nomes de clubes no JogoManager. Compare países e escolha uma competição para sua carreira.`;

export const Route = createFileRoute("/ligas-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Ligas de futebol", path: PATH },
      ]),
    ],
  }),
  component: LeaguesPage,
});

function LeaguesPage() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredLeagues = useMemo(() => {
    if (!normalizedQuery) return BUNDLED_LEAGUES;
    return BUNDLED_LEAGUES.filter((league) =>
      [
        league.name,
        league.country,
        ...league.clubs.filter((club) => hasPublicClubName(club.name)).map((club) => club.name),
      ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery)),
    );
  }, [normalizedQuery]);

  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-5xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Competições</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Ligas de futebol e clubes disponíveis no jogo
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          O catálogo de carreira reúne {BUNDLED_LEAGUES.length} competições e {NAMED_CLUB_COUNT}{" "}
          nomes de clubes identificados. Pesquise por liga, país ou equipe, confira os campeonatos
          disponíveis e use os critérios abaixo para escolher onde começar. Esta é a lista do jogo,
          não uma tabela ao vivo de resultados ou classificação.
        </p>

        <div className="mt-7 max-w-xl">
          <label htmlFor="league-search" className="mb-2 block text-sm font-medium">
            Buscar por liga, país ou clube
          </label>
          <input
            id="league-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Ex.: Brasil, Brasileirão, Flamengo"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground outline-none ring-primary/40 placeholder:text-muted-foreground focus:ring-2"
          />
          <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
            {filteredLeagues.length} de {BUNDLED_LEAGUES.length} competições
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {filteredLeagues.map((l) => {
            const namedClubs = l.clubs.filter((club) => hasPublicClubName(club.name));
            return (
              <section
                key={l.id}
                className="rounded-xl border border-border/60 surface-card p-5 backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <Flag league={l.id} country={l.country} size={28} />
                  <div>
                    <h2 className="font-display text-xl leading-tight">{l.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {l.country} · {namedClubs.length} nomes de clubes listados
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {namedClubs.map((c) => c.name).join(", ") ||
                    "Não há nomes de clubes identificados nesta competição."}
                  .
                </p>
              </section>
            );
          })}
          {filteredLeagues.length === 0 && (
            <p className="rounded-xl border border-border/60 p-5 text-sm text-muted-foreground">
              Nenhuma liga ou equipe corresponde a “{query}”. Tente outro país, competição ou nome
              de clube.
            </p>
          )}
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Escolher meu clube
          </Link>
          <Link
            to="/guias"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Guias para iniciantes
          </Link>
        </div>

        <section
          className="mt-14 rounded-2xl border border-border/60 surface-card p-6"
          aria-labelledby="escolher-liga"
        >
          <h2 id="escolher-liga" className="font-display text-2xl">
            Como escolher uma liga para a carreira
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Comece pela competição que você tem vontade de acompanhar e, em seguida, confira que
            tipo de desafio o clube escolhido oferece. A divisão ajuda a identificar o contexto, mas
            não resume o elenco, o objetivo da diretoria nem o orçamento inicial da carreira.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Entradas sem identificação de clube são omitidas desta listagem até que exista um nome
            útil para consultar. A contagem apresentada corresponde apenas aos nomes identificados.
          </p>
          <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Escolha país e competição.</strong> Use o nome da
              liga e a contagem de nomes listados para localizar uma temporada que você queira
              jogar.
            </li>
            <li>
              <strong className="text-foreground">Revise o desafio do clube.</strong> Depois de
              iniciar, confira a meta da diretoria, o orçamento e as posições do elenco. Os
              parâmetros iniciais variam por clube e perfil do treinador; não deduza tudo somente
              pela divisão.
            </li>
            <li>
              <strong className="text-foreground">Veja se há uma pirâmide conectada.</strong> Se a
              sua ideia é subir ou evitar o rebaixamento ao longo de temporadas, escolha uma liga
              que participe de divisões conectadas no jogo. Algumas competições são independentes.
            </li>
            <li>
              <strong className="text-foreground">
                Teste o ritmo antes de uma temporada longa.
              </strong>{" "}
              Uma partida rápida permite conhecer os controles e a apresentação antes de iniciar uma
              carreira.
            </li>
          </ol>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            No futebol brasileiro, a carreira liga Série A, B, C e grupos da Série D. O guia de{" "}
            <Link to="/brasileirao" className="text-primary underline">
              clubes do Brasileirão no jogo
            </Link>{" "}
            detalha as equipes de A e B. Para preparar a primeira escalação, continue pelo{" "}
            <Link to="/guias" className="text-primary underline">
              guia de início de carreira
            </Link>
            .
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Os nomes e a quantidade de clubes descrevem o catálogo do simulador. Calendários,
            participantes e classificações de competições reais podem mudar e devem ser consultados
            com os organizadores oficiais.
          </p>
        </section>

        <PublicLinks exclude="/ligas-de-futebol" />
      </div>
    </div>
  );
}
