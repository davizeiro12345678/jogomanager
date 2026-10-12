import { createFileRoute, Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/melhores-formacoes";
const TITLE = "Melhores Formações de Futebol | Guia 4-3-3 e 4-2-3-1";
const DESC =
  "Compare 4-3-3, 4-2-3-1, 4-4-2 e 3-5-2: pontos fortes, limitações e ajustes para escolher a tática do seu elenco no manager de futebol.";

export const Route = createFileRoute("/melhores-formacoes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Melhores formações de futebol", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Melhores formações", path: PATH },
      ]),
    ],
  }),
  component: FormationsPage,
});

const FORMATIONS = [
  {
    name: "4-3-3",
    good: "Pressão alta, posse e amplitude. Ideal quando você tem pontas rápidas e um volante que recompõe.",
    bad: "Meio-campo exposto contra times com três meias criativos.",
  },
  {
    name: "4-4-2",
    good: "Bloco compacto e duas linhas de quatro. Perfeito para elenco mediano e jogo direto com dois atacantes.",
    bad: "Perde a bola no meio contra 4-3-3; exige laterais com fôlego.",
  },
  {
    name: "4-2-3-1",
    good: "Equilíbrio moderno: dois volantes protegem, o meia-armador decide. O esquema mais seguro para começar.",
    bad: "Depende muito do centroavante; se ele some, o time não finaliza.",
  },
  {
    name: "3-5-2",
    good: "Domina o meio e usa alas por fora. Ótimo contra times de dois atacantes fixos.",
    bad: "Vulnerável nas costas dos alas; precisa de três zagueiros rápidos.",
  },
  {
    name: "5-3-2",
    good: "Defesa fechada para segurar resultado fora de casa ou contra clubes muito superiores.",
    bad: "Poucas chances criadas; entrega a posse ao adversário.",
  },
];

function FormationsPage() {
  return (
    <ArticleShell
      kicker="Táticas"
      title="Melhores formações e quando usar cada uma"
      intro="Não existe formação perfeita — existe a formação certa para o seu elenco e para o adversário da rodada. Veja o que cada esquema entrega e o que ele cobra."
      path={PATH}
      readMinutes={12}
      level="Iniciante"
      updated="outubro de 2026"
      toc={[
        ...FORMATIONS.map((f) => ({ id: f.name, title: f.name })),
        { id: "escolher", title: "Como escolher na prática" },
        { id: "ajustes", title: "Os três ajustes que mais mudam o jogo" },
        { id: "intervalo", title: "O que mexer no intervalo" },
        { id: "diagnostico", title: "Diagnóstico tático" },
        { id: "exemplos", title: "Três cenários de jogo" },
        { id: "comparar", title: "Como testar mudanças" },
      ]}
      faq={[
        {
          q: "Qual formação é a mais segura para um elenco fraco?",
          a: "Esquemas com cobertura defensiva podem ajudar, mas compare os jogadores disponíveis e teste a organização antes de decidir. Nenhuma formação garante menos chances ao rival.",
        },
        {
          q: "Devo copiar a formação do time adversário?",
          a: "Não. Escolha pelo seu elenco e use os ajustes de linha e marcação para neutralizar o ponto forte do rival.",
        },
      ]}
    >
      {FORMATIONS.map((f) => (
        <Section key={f.name} id={f.name} title={f.name}>
          <p>
            <strong className="text-foreground">Forte em:</strong> {f.good}
          </p>
          <p>
            <strong className="text-foreground">Cuidado com:</strong> {f.bad}
          </p>
        </Section>
      ))}
      <Section id="escolher" title="Como escolher na prática">
        <p>
          Comece pela sua melhor posição: se os dois melhores jogadores são pontas, jogue 4-3-3; se
          são dois centroavantes, 4-4-2. Trocar de esquema no intervalo é normal — ajuste a
          mentalidade e a marcação antes de mexer nos nomes.
        </p>
      </Section>
      <Section id="ajustes" title="Os três ajustes que mais mudam o jogo">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Mentalidade</strong> orienta a postura geral do time.
            Uma opção mais ofensiva pode aumentar a presença no ataque, mas exige atenção aos espaços deixados para trás.
          </li>
          <li>
            <strong className="text-foreground">Altura da linha</strong> influencia o espaço atrás
            da defesa. Linha alta pode pressionar mais à frente, mas permite ataques às costas dos zagueiros.
          </li>
          <li>
            <strong className="text-foreground">Ritmo</strong> muda a velocidade pretendida das ações.
            Acompanhe a condição física e evite presumir que acelerar sempre produzirá mais chances.
          </li>
        </ul>
      </Section>
      <Section id="intervalo" title="O que mexer no intervalo">
        <p>
          Perdendo em casa: suba a mentalidade um nível e a linha também — não os dois ao mesmo
          tempo se o adversário tem velocidade. Ganhando fora: baixe o ritmo, recue a linha e guarde
          uma substituição para os últimos quinze minutos. Para ver em quais ligas o mandante mais
          vence, consulte as{" "}
          <Link to="/tabelas" className="text-primary underline">
            tabelas reais
          </Link>
          .
        </p>
      </Section>

      <Section id="diagnostico" title="Diagnóstico: o que observar antes de trocar de esquema">
        <p>
          Repare em quatro perguntas: o adversário chega pela lateral ou pelo centro? Seus
          volantes conseguem proteger a entrada da área? Seus atacantes recebem a bola
          em condições de finalizar? A equipe consegue recuperar a posse sem abrir espaços?
        </p>
        <p>
          Uma formação desenha posições de partida, mas a qualidade do plano depende de
          quem ocupa cada função. Um 4-3-3 com pontas que retornam para marcar pode
          oferecer equilíbrio diferente de um 4-3-3 que mantém os três atacantes adiantados.
          Por isso, evite comparar apenas os números da formação.
        </p>
      </Section>
      <Section id="exemplos" title="Três cenários táticos para estudar">
        <h3 className="font-display text-base text-foreground">Cenário A: pontas velozes, meio-campo limitado</h3>
        <p>
          No 4-3-3, a equipe pode explorar profundidade pelos lados, mas precisa proteger
          o setor central. Se o adversário acumula jogadores por dentro, experimente apoio
          adicional de um volante ou um ajuste da pressão, sem trocar tudo de uma só vez.
        </p>
        <h3 className="font-display text-base text-foreground">Cenário B: dois volantes fortes e um armador</h3>
        <p>
          O 4-2-3-1 permite distribuir responsabilidade defensiva na frente dos zagueiros
          e deixar um meia mais livre para organizar. Analise se o centroavante está
          isolado e se os extremos conseguem participar da criação.
        </p>
        <h3 className="font-display text-base text-foreground">Cenário C: vantagem pequena no fim da partida</h3>
        <p>
          Recuar a linha pode proteger a área, mas também entregar o meio-campo ao rival.
          Antes de trocar para cinco defensores, observe o perfil dos substitutos, o
          desgaste físico e de onde vêm as oportunidades do adversário.
        </p>
        <p>
          Esses exemplos ensinam raciocínio tático: os resultados específicos precisam ser
          testados na sua versão do simulador.
        </p>
      </Section>
      <Section id="comparar" title="Como testar se uma mudança tática realmente funcionou">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Comece com uma formação que aproveite os melhores jogadores nas posições naturais.</li>
          <li>Observe duas ou três partidas, levando em conta a força dos adversários.</li>
          <li>Altere uma variável: formação, mentalidade, linha ou substituições.</li>
          <li>Compare oportunidades criadas, espaços defensivos e desgaste dos atletas.</li>
          <li>Evite concluir que uma tática é superior com base em apenas uma vitória ou derrota.</li>
        </ol>
        <p>
          Para construir o elenco adequado ao seu plano, use o
          <Link to="/guia-de-scouting" className="text-primary underline"> guia de scouting</Link>
          e organize as contratações com o
          <Link to="/mercado-de-transferencias" className="text-primary underline">
          guia de transferências</Link>.
        </p>
      </Section>
    </ArticleShell>
  );
}
