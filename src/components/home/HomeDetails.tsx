import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

const DECISIONS = [
  {
    title: "Prepare o elenco",
    text: "Confira condição física, suspensões e banco antes de escalar. Distribua os minutos para chegar inteiro à próxima rodada.",
    to: "/guias",
    cta: "Preparar minha primeira temporada",
  },
  {
    title: "Dê uma identidade ao time",
    text: "Escolha formação, mentalidade e pressão. Observe o adversário e ajuste o plano durante a partida.",
    to: "/taticas-e-formacoes",
    cta: "Entender as táticas",
  },
  {
    title: "Contrate com um plano",
    text: "Compare posição, idade, contrato e custo. Um reforço precisa caber no elenco e na folha salarial.",
    to: "/guia-de-scouting",
    cta: "Aprender a observar jogadores",
  },
  {
    title: "Construa uma carreira",
    text: "Acompanhe orçamento, metas da diretoria e resultados da temporada. Exporte uma cópia da carreira antes de grandes alterações.",
    to: "/gestao-financeira",
    cta: "Organizar as finanças",
  },
] as const;
const FAQ = [
  [
    "Preciso criar uma conta para começar?",
    "Você pode jogar como convidado. A carreira fica neste navegador; uma conta permite usar os recursos de nuvem quando a conexão está disponível.",
  ],
  [
    "Como encontro outros jogadores?",
    "Entre pelo convite do Discord nesta página e combine uma partida. Compartilhe o código da sala apenas com quem você quer convidar.",
  ],
  [
    "Como protejo minha carreira?",
    "Exporte uma cópia no editor e confira a sincronização antes de trocar de aparelho ou limpar os dados do navegador.",
  ],
  [
    "Onde aprendo a jogar melhor?",
    "Os guias explicam escalação, táticas, scouting e finanças. Comece por uma partida rápida e aplique uma mudança por vez.",
  ],
] as const;

export function HomeDetails() {
  return (
    <>
      <section className="mt-14" aria-labelledby="manager-routine">
        <p className="font-display text-xs uppercase tracking-widest text-primary">
          Além do placar
        </p>
        <h2 id="manager-routine" className="mt-2 font-display text-3xl">
          Cada rodada começa nas suas decisões
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {DECISIONS.map((item) => (
            <article
              key={item.title}
              className="surface-card rounded-xl border border-border/60 p-5"
            >
              <h3 className="font-display text-xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              <Link
                to={item.to}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-primary"
              >
                {item.cta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-14" aria-labelledby="home-faq">
        <h2 id="home-faq" className="font-display text-2xl">
          Antes do primeiro apito
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FAQ.map(([question, answer]) => (
            <details key={question} className="surface-card rounded-xl border border-border/60 p-4">
              <summary className="cursor-pointer font-display text-lg">{question}</summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
        <Link
          to="/perguntas-frequentes"
          className="mt-4 inline-flex min-h-11 items-center text-sm text-primary"
        >
          Ver todas as perguntas →
        </Link>
      </section>
    </>
  );
}
