import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/guias";
const TITLE = "Tutorial e dicas para vencer no manager de futebol | Pro Football Manager 3D";
const DESC =
  "Dicas práticas para vencer desde a 1ª rodada: escolha do clube, escalação, tática, salários, treino e como agradar a diretoria e a torcida.";

export const Route = createFileRoute("/guias")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Guias de manager de futebol", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Guias", path: PATH },
      ]),
    ],
  }),
  component: GuidesPage,
});

const GUIDES = [
  {
    id: "primeiro-clube",
    title: "Como escolher seu primeiro clube",
    body: "Times com força acima de 85 cobram título imediato; entre 70 e 78 você tem paciência da diretoria para construir um projeto. Se é sua primeira carreira, comece num clube de meio de tabela do Brasileirão: o orçamento é razoável e a cobrança é justa.",
    extra: "Regra prática: quanto maior o clube, menor a margem de erro nas dez primeiras rodadas.",
  },
  {
    id: "escalacao",
    title: "Escalação: o básico que ganha jogo",
    body: "Nunca escale jogador com condição abaixo de 70 — ele cai de rendimento no segundo tempo. Respeite as posições: um atacante improvisado na zaga custa gols. Deixe pelo menos um goleiro e dois defensores no banco.",
    extra: "Confira a condição física antes de cada rodada, não só antes dos clássicos.",
  },
  {
    id: "tatica",
    title: "Tática: mentalidade, pressão e ritmo",
    body: "Contra times mais fortes, use bloco baixo e mentalidade defensiva; contra times inferiores, pressão alta e mentalidade ofensiva. O ritmo alto cansa mais rápido: use no início e recue no segundo tempo para segurar o resultado.",
    extra: "Ajustar a tática no intervalo vale mais que trocar três jogadores de uma vez.",
  },
  {
    id: "dinheiro",
    title: "Dinheiro: salários antes de contratações",
    body: "Cada contratação soma salário semanal. Antes de comprar, veja quanto sobra do orçamento depois da folha e do custo da comissão técnica. Renovar contrato de quem está prestes a acabar é mais barato que substituir o jogador.",
    extra: "Folha acima de 65% da receita é o começo de qualquer crise financeira no jogo.",
  },
  {
    id: "treino",
    title: "Treino e lesões",
    body: "Treino de intensidade alta melhora atributos, mas aumenta o risco de lesão e a fadiga acumulada. Alterne semanas de foco físico com semanas de recuperação, especialmente perto de clássicos.",
    extra: "Elenco curto e treino forte na mesma temporada é a receita mais rápida de desastre.",
  },
  {
    id: "diretoria",
    title: "Diretoria e torcida",
    body: "A pressão sobe com derrotas seguidas e com a distância do objetivo da temporada. Sequências de vitórias e bom desempenho em clássicos recuperam a aprovação rápido — e evitam a demissão.",
    extra: "Cumprir a meta da temporada libera orçamento maior na janela seguinte.",
  },
] as const;

const FAQ = [
  {
    q: "Preciso instalar alguma coisa para jogar?",
    a: "Não. O jogo roda direto no navegador, no computador ou no celular, e a carreira fica salva para você continuar depois.",
  },
  {
    q: "Qual clube é o melhor para começar?",
    a: "Um clube de meio de tabela, com força entre 70 e 78. Ele tem orçamento para reforços e a diretoria não cobra título logo na primeira temporada.",
  },
  {
    q: "Dá para simular a partida em vez de assistir?",
    a: "Sim. Você pode acompanhar o jogo em 3D, acelerar a simulação ou pular direto para o resultado.",
  },
  {
    q: "Em quanto tempo consigo subir de divisão?",
    a: "Com elenco bem montado e tática coerente, o acesso costuma vir entre a primeira e a terceira temporada.",
  },
] as const;

function GuidesPage() {
  return (
    <ArticleShell
      kicker="Guias"
      title="Guias de manager de futebol"
      intro="Tudo que você precisa para comandar um clube: escolha do time, escalação, tática, finanças e relação com a diretoria. Depois de ler, é só assumir um clube e jogar direto no navegador."
      path={PATH}
      readMinutes={7}
      level="Iniciante"
      updated="outubro de 2026"
      toc={GUIDES.map((g) => ({ id: g.id, title: g.title }))}
      faq={FAQ}
    >
      <Section id="primeiros-passos" title="Seu roteiro para as primeiras rodadas">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Escolha um clube e leia o objetivo da diretoria antes de mexer no elenco.</li>
          <li>
            Monte uma formação simples, confira a condição física e deixe alternativas no banco.
          </li>
          <li>
            Jogue a primeira rodada com o mesmo plano e observe onde o time cria e concede chances.
          </li>
          <li>
            Revise uma decisão por vez: formação, pressão ou substituições. Compare o efeito nos
            próximos jogos.
          </li>
          <li>
            Antes de contratar, confira folha salarial, contratos e a reserva para o restante da
            temporada.
          </li>
        </ol>
      </Section>
      <Section title="Aprofunde a decisão que está tomando agora">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              to: "/taticas-e-formacoes",
              title: "Táticas e formações",
              detail: "Entenda o papel de cada setor e escolha um esquema para o seu elenco.",
            },
            {
              to: "/guia-de-scouting",
              title: "Scouting",
              detail: "Compare atletas por função, potencial e custo antes de negociar.",
            },
            {
              to: "/gestao-financeira",
              title: "Finanças",
              detail: "Organize salários e transferências para sustentar o projeto.",
            },
            {
              to: "/jogar-offline",
              title: "Progresso e backup",
              detail: "Conheça o uso offline e mantenha uma cópia da sua carreira.",
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg border border-border/60 p-4 transition hover:border-primary"
            >
              <span className="block font-display text-base text-primary">{item.title} →</span>
              <span className="mt-2 block text-sm">{item.detail}</span>
            </Link>
          ))}
        </div>
      </Section>
      {GUIDES.map((g) => (
        <Section key={g.id} id={g.id} title={g.title}>
          <p>{g.body}</p>
          <p className="text-foreground/80">{g.extra}</p>
        </Section>
      ))}
    </ArticleShell>
  );
}
