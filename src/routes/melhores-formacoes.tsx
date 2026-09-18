import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/melhores-formacoes";
const TITLE =
  "Melhores formações de futebol: quando usar 4-3-3, 4-4-2 e 3-5-2 · Pro Football Manager 3D: Jogo de Futebol Manager Online";
const DESC =
  "As melhores formações do futebol explicadas: 4-3-3, 4-4-2, 3-5-2 e quando usar cada uma para vencer no jogo de manager.";

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
      readMinutes={5}
      level="Iniciante"
      updated="setembro de 2026"
      toc={[
        ...FORMATIONS.map((f) => ({ id: f.name, title: f.name })),
        { id: "escolher", title: "Como escolher na prática" },
      ]}
      faq={[
        {
          q: "Qual formação é a mais segura para um elenco fraco?",
          a: "5-3-2 fora de casa e 4-4-2 em casa: as duas mantêm duas linhas compactas e reduzem as chances do adversário.",
        },
        {
          q: "Devo copiar a formação do time adversário?",
          a: "Não. Escolha pelo seu elenco e use os ajustes de linha e marcação para neutralizar o ponto forte do rival.",
        },
      ]}
    >
      {FORMATIONS.map((f) => (
        <Section key={f.name} title={f.name}>
          <p>
            <strong className="text-foreground">Forte em:</strong> {f.good}
          </p>
          <p>
            <strong className="text-foreground">Cuidado com:</strong> {f.bad}
          </p>
        </Section>
      ))}
      <Section title="Como escolher na prática">
        <p>
          Comece pela sua melhor posição: se os dois melhores jogadores são pontas, jogue 4-3-3; se
          são dois centroavantes, 4-4-2. Trocar de esquema no intervalo é normal — ajuste a
          mentalidade e a marcação antes de mexer nos nomes.
        </p>
      </Section>
    </ArticleShell>
  );
}
