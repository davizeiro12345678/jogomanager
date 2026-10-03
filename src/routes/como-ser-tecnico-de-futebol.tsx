import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/como-ser-tecnico-de-futebol";
const TITLE = "Carreira de técnico de futebol: como começar do zero | Pro Football Manager 3D";
const DESC =
  "Carreira de treinador passo a passo: escolher o clube certo, montar a primeira escalação, definir a tática de estreia, controlar salários e sobreviver às dez primeiras rodadas. Guia gratuito, jogável direto no navegador.";

export const Route = createFileRoute("/como-ser-tecnico-de-futebol")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Como ser técnico de futebol no jogo", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Como ser técnico de futebol", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const STEPS = [
  {
    t: "1. Escolha um clube compatível com sua paciência",
    d: "Clube forte significa cobrança imediata: perder duas partidas seguidas já derruba a aprovação. Um time de meio de tabela dá margem para errar enquanto você aprende o jogo.",
  },
  {
    t: "2. Leia o elenco antes de escalar",
    d: "Verifique posição, idade, condição física e moral. Jogador abaixo de 70 de condição cai de rendimento no segundo tempo, e improvisar posição custa gols.",
  },
  {
    t: "3. Escolha a formação pelo elenco, não pelo gosto",
    d: "Se você tem três atacantes bons e um meio fraco, o 4-3-3 rende. Com dois volantes fortes e pouca ponta, o 4-4-2 protege melhor.",
  },
  {
    t: "4. Ajuste mentalidade e ritmo por adversário",
    d: "Contra times mais fortes: bloco baixo, mentalidade defensiva. Contra inferiores: pressão alta e ritmo acelerado no primeiro tempo, recuando depois para segurar o resultado.",
  },
  {
    t: "5. Cuide da folha salarial antes de contratar",
    d: "Cada reforço soma salário semanal. Antes de comprar, veja quanto sobra do orçamento depois da folha e da comissão técnica.",
  },
  {
    t: "6. Renove contratos com antecedência",
    d: "No último ano de contrato o jogador exige muito mais ou sai de graça. Renovar cedo é sempre mais barato do que substituir.",
  },
  {
    t: "7. Acompanhe a diretoria",
    d: "O painel mostra o objetivo da temporada e a pressão acumulada. Sequências de vitórias e bom desempenho em clássicos recuperam a confiança rápido.",
  },
];

function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Iniciantes</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Como ser técnico de futebol no jogo
        </h1>
        <p className="mt-4 text-muted-foreground">
          Sete passos para tirar sua primeira carreira do papel e chegar ao fim da temporada sem ser
          demitido.
        </p>

        <div className="mt-8 space-y-5">
          {STEPS.map((s) => (
            <section key={s.t}>
              <h2 className="font-display text-xl">{s.t}</h2>
              <p className="mt-1 text-muted-foreground">{s.d}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Criar minha carreira
          </Link>
          <Link
            to="/taticas-e-formacoes"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest"
          >
            Estudar táticas
          </Link>
        </div>

        <PublicLinks exclude={PATH} />
      </article>
    </div>
  );
}
