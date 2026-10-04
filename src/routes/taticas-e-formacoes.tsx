import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section, type GuideFaq, type GuideTocItem } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/taticas-e-formacoes";
const TITLE = "Táticas e formações de futebol | Pro Football Manager 3D";
const DESC =
  "Qual formação usar em cada jogo: pontos fortes e fracos do 4-3-3, 4-4-2, 3-5-2 e 5-3-2, altura da linha defensiva, pressão, ritmo e como virar um jogo no intervalo.";

export const Route = createFileRoute("/taticas-e-formacoes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Melhores táticas e formações", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Táticas e formações", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const FORMATIONS = [
  {
    id: "f433",
    name: "4-3-3",
    when: "Elenco com pontas rápidas e meio de campo com bom passe.",
    how: "Combine com mentalidade ofensiva e linha alta. Cansa mais: troque as pontas por volta dos 65 minutos.",
  },
  {
    id: "f442",
    name: "4-4-2",
    when: "Elenco equilibrado, sem estrelas nas pontas.",
    how: "A formação mais estável do jogo. Mentalidade equilibrada e ritmo médio seguram bem qualquer adversário.",
  },
  {
    id: "f4231",
    name: "4-2-3-1",
    when: "Você tem um meia criativo e dois volantes de marcação.",
    how: "Boa contra times fortes: bloco médio, transição rápida e o meia livre entre as linhas.",
  },
  {
    id: "f352",
    name: "3-5-2",
    when: "Alas com fôlego alto e três zagueiros confiáveis.",
    how: "Domina o meio-campo, mas sofre em contra-ataques pelos lados. Use pressão alta só quando estiver à frente no placar.",
  },
  {
    id: "f532",
    name: "5-3-2",
    when: "Você é o time mais fraco em campo, ou está segurando um resultado.",
    how: "Bloco baixo, mentalidade defensiva, ritmo baixo. Aposte em bola parada e contra-ataque.",
  },
] as const;

const TOC: readonly GuideTocItem[] = [
  ...FORMATIONS.map((f) => ({ id: f.id, title: f.name })),
  { id: "ajustes", title: "Os três ajustes que mais mudam o jogo" },
  { id: "intervalo", title: "O que mexer no intervalo" },
];

const FAQ: readonly GuideFaq[] = [
  {
    q: "Qual é a melhor formação para começar?",
    a: "4-2-3-1 ou 4-4-2. As duas protegem o meio-campo e perdoam erros de escalação enquanto você conhece o elenco.",
  },
  {
    q: "Posso trocar de formação no meio da partida?",
    a: "Pode, e às vezes deve. Trocar mentalidade e altura da linha costuma resolver antes de mudar o desenho todo.",
  },
  {
    q: "Pressão alta funciona sempre?",
    a: "Não. Contra times com atacantes velozes ela vira contra-ataque. Use com defesa rápida e quando o time estiver com boa condição física.",
  },
];

function Page() {
  return (
    <ArticleShell
      kicker="Tática"
      title="Melhores táticas e formações"
      intro="Não existe formação invencível: existe formação que combina com o seu elenco e com o adversário da rodada. Veja o resumo de cada uma e os ajustes que decidem partidas."
      path={PATH}
      readMinutes={6}
      level="Intermediário"
      updated="setembro de 2026"
      toc={TOC}
      faq={FAQ}
    >
      {FORMATIONS.map((f) => (
        <Section key={f.id} id={f.id} title={f.name}>
          <p>
            <strong className="text-foreground">Quando usar:</strong> {f.when}
          </p>
          <p>
            <strong className="text-foreground">Como ajustar:</strong> {f.how}
          </p>
        </Section>
      ))}

      <Section id="ajustes" title="Os três ajustes que mais mudam o jogo">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Mentalidade</strong> define quantos jogadores sobem
            no ataque. Ofensiva cria mais chances e concede mais contra-ataques.
          </li>
          <li>
            <strong className="text-foreground">Altura da linha</strong> decide onde você recupera a
            bola. Linha alta contra time lento, linha baixa contra atacante veloz.
          </li>
          <li>
            <strong className="text-foreground">Ritmo</strong> acelera as jogadas e a fadiga. Ritmo
            alto o jogo inteiro derruba a condição física no último terço da partida.
          </li>
        </ul>
      </Section>

      <Section id="intervalo" title="O que mexer no intervalo">
        <p>
          Perdendo em casa: suba a mentalidade um nível e a linha também — não os dois ao mesmo
          tempo se o adversário tem velocidade. Ganhando fora: baixe o ritmo, recue a linha e guarde
          uma substituição para os últimos quinze minutos.
        </p>
      </Section>
    </ArticleShell>
  );
}
