import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/dicas-de-gestao";
const TITLE = "Dicas de gestão do clube | Pro Football Manager 3D";
const DESC =
  "Dicas práticas de gestão para vencer no manager de futebol: elenco, moral, condição física, finanças do clube e leitura de jogo.";

export const Route = createFileRoute("/dicas-de-gestao")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Dicas de gestão para soccer manager", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Dicas de gestão", path: PATH },
      ]),
    ],
  }),
  component: TipsPage,
});

const GROUPS = [
  {
    id: "elenco",
    title: "Elenco: tamanho e equilíbrio",
    tips: [
      "Mantenha o elenco entre 22 e 26 jogadores: menos que isso quebra em lesões, mais que isso desperdiça salário.",
      "Contrate por posição carente, não por nota geral. Um lateral 74 vale mais que um atacante 80 quando você já tem três atacantes.",
      "Jogadores de 18 a 21 anos com potencial alto valorizam rápido; jogue-os em partidas fáceis para acelerar o crescimento.",
    ],
  },
  {
    id: "contratos",
    title: "Contratos e valorização",
    tips: [
      "Renove contratos com dois anos de antecedência — no último ano o jogador exige o dobro ou sai de graça.",
      "Venda quem tem mais de 30 anos e valor de mercado alto: é o pico do lucro.",
      "Cláusula de rescisão baixa é convite para perder titular. Suba a cláusula ao renovar.",
    ],
  },
  {
    id: "vestiario",
    title: "Vestiário e moral",
    tips: [
      "Moral baixa derruba o rendimento em campo. Dê minutos a quem está insatisfeito antes de ele pedir para sair.",
      "Comissão técnica boa acelera recuperação de lesões e melhora o treino — costuma render mais que um reserva caro.",
      "Antes de clássicos, poupe titulares na rodada anterior se o adversário for fraco.",
    ],
  },
  {
    id: "caixa",
    title: "Caixa e metas da diretoria",
    tips: [
      "Não gaste todo o orçamento na primeira janela: guarde reserva para repor lesões no meio da temporada.",
      "Cumpra a meta da diretoria antes de sonhar com título: sobreviver à primeira temporada é o que abre orçamento na segunda.",
      "Acompanhe as ofertas recebidas: às vezes vender um titular por muito acima do valor financia dois reforços melhores.",
    ],
  },
] as const;

const FAQ = [
  {
    q: "Quantos jogadores devo ter no elenco?",
    a: "Entre 22 e 26. Abaixo disso, duas lesões já comprometem a escalação; acima, você paga salário para quem quase não joga.",
  },
  {
    q: "Vale a pena treinar sempre em intensidade alta?",
    a: "Não. O ganho de atributos vem junto com fadiga e lesão. Alterne semanas fortes com semanas de recuperação.",
  },
  {
    q: "Quando a diretoria demite o treinador?",
    a: "Quando a sequência de derrotas se soma ao distanciamento da meta da temporada. Vitórias seguidas recuperam a confiança rapidamente.",
  },
] as const;

function TipsPage() {
  return (
    <ArticleShell
      kicker="Dicas"
      title="Dicas de gestão para soccer manager"
      intro="Doze regras práticas que separam o treinador demitido na décima rodada do técnico que levanta taça. Valem para qualquer carreira, do clube pequeno ao gigante europeu."
      path={PATH}
      readMinutes={6}
      level="Intermediário"
      updated="setembro de 2026"
      toc={GROUPS.map((g) => ({ id: g.id, title: g.title }))}
      faq={FAQ}
    >
      {GROUPS.map((g) => (
        <Section key={g.id} id={g.id} title={g.title}>
          <ul className="space-y-2">
            {g.tips.map((t) => (
              <li key={t} className="flex gap-3">
                <span aria-hidden className="text-primary">
                  •
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </ArticleShell>
  );
}
