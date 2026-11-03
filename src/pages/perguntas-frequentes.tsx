import { Link } from "@tanstack/react-router";
import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";

import { FAQ_COUNT, FAQ_GROUPS, searchFaq } from "@/content/faq";

import { PublicLinks } from "@/components/PublicLinks";

import { CommunityInvite } from "@/components/CommunityInvite";
import { PERGUNTAS_FREQUENTES_PATH as PATH } from "@/lib/public-route-paths";

export function Page() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const groups = searchFaq(deferred);
  const found = groups.reduce((n, g) => n + g.questions.length, 0);
  return (
    <main className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Ajuda</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Perguntas frequentes sobre o jogo
        </h1>
        <p className="mt-4 text-muted-foreground">
          Entenda como começar, escolher o clube, acompanhar partidas em 3D, proteger o progresso da
          carreira e resolver problemas. As respostas explicam o que verificar; a disponibilidade de
          cada recurso pode variar com a versão e o modo de jogo. São {FAQ_COUNT} respostas em{" "}
          {FAQ_GROUPS.length} temas.
        </p>

        <section aria-labelledby="faq-search-title" className="mt-8">
          <h2 id="faq-search-title" className="font-display text-lg">
            Buscar nas perguntas
          </h2>
          <label className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-border/60 surface-card px-4 focus-within:border-primary">
            <Search size={18} aria-hidden className="text-muted-foreground" />
            <span className="sr-only">Digite uma palavra, como save, moedas ou celular</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: save, moedas, celular, formação"
              className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
            />
          </label>
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {deferred.trim()
              ? found === 0
                ? "Nenhuma resposta encontrada. Tente outra palavra ou fale com o suporte."
                : `${found} ${found === 1 ? "resposta encontrada" : "respostas encontradas"}`
              : "Digite para filtrar as respostas na hora."}
          </p>
        </section>

        <nav
          aria-label="Navegar por assuntos"
          className="mt-8 rounded-xl border border-border/60 surface-card p-5"
        >
          <h2 className="font-display text-lg">Encontre o assunto</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {FAQ_GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  {group.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {groups.map((group) => (
          <section id={group.id} key={group.id} className="mt-12 scroll-mt-24">
            <h2 className="font-display text-2xl">{group.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{group.intro}</p>
            <dl className="mt-5 space-y-4">
              {group.questions.map(({ q, a }) => (
                <div key={q} className="rounded-xl border border-border/60 surface-card p-4">
                  <dt className="font-display text-lg">{q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="mt-12 rounded-xl border border-primary/30 surface-card p-5">
          <h2 className="font-display text-xl">Guias para ir além das respostas rápidas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Veja exemplos de escalação, scouting e planejamento financeiro. Para sua primeira
            temporada, siga os passos do guia completo e compare as principais formações.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Link className="text-primary underline" to="/guias">
              Guias do treinador
            </Link>
            <Link className="text-primary underline" to="/melhores-formacoes">
              Táticas e formações
            </Link>
            <Link className="text-primary underline" to="/jogar-offline">
              Salvamento offline
            </Link>
            <Link className="text-primary underline" to="/contato">
              Contato e suporte
            </Link>
          </div>
        </section>

        <div className="mt-10">
          <Link
            to="/new"
            className="inline-flex rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar a jogar
          </Link>
        </div>
        <CommunityInvite compact />
        <PublicLinks exclude={PATH} />
      </article>
    </main>
  );
}
