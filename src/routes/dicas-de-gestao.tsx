import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/dicas-de-gestao";
const TITLE =
  "Dicas de gestão para soccer manager: 12 táticas que funcionam · Pro Football Manager 3D: Jogo de Futebol Manager Online";
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

const TIPS = [
  "Mantenha o elenco entre 22 e 26 jogadores: menos que isso quebra em lesões, mais que isso desperdiça salário.",
  "Contrate por posição carente, não por nota geral. Um lateral 74 vale mais que um atacante 80 quando você já tem três atacantes.",
  "Jogadores de 18 a 21 anos com potencial alto valorizam rápido; jogue-os em partidas fáceis para acelerar o crescimento.",
  "Renove contratos com dois anos de antecedência — no último ano o jogador exige o dobro ou sai de graça.",
  "Venda quem tem mais de 30 anos e valor de mercado alto: é o pico do lucro.",
  "Cláusula de rescisão baixa é convite para perder titular. Suba a cláusula ao renovar.",
  "Moral baixa derruba o rendimento em campo. Dê minutos a quem está insatisfeito antes de ele pedir para sair.",
  "Não gaste todo o orçamento na primeira janela: guarde reserva para repor lesões no meio da temporada.",
  "Comissão técnica boa acelera recuperação de lesões e melhora o treino — costuma render mais que um reserva caro.",
  "Antes de clássicos, poupe titulares na rodada anterior se o adversário for fraco.",
  "Cumpra a meta da diretoria antes de sonhar com título: sobreviver à primeira temporada é o que abre orçamento na segunda.",
  "Acompanhe as ofertas recebidas: às vezes vender um titular por muito acima do valor financia dois reforços melhores.",
];

function TipsPage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Dicas</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Dicas de gestão para soccer manager
        </h1>
        <p className="mt-4 text-muted-foreground">
          Doze regras práticas que separam o treinador demitido na décima rodada do técnico que
          levanta taça. Valem para qualquer carreira, do clube pequeno ao gigante europeu.
        </p>

        <ol className="mt-10 space-y-4">
          {TIPS.map((t, i) => (
            <li key={t} className="flex gap-4 rounded-xl border border-border/60 surface-card p-4">
              <span className="font-display text-2xl text-primary">{i + 1}</span>
              <p className="text-sm leading-relaxed text-muted-foreground">{t}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
          >
            Começar carreira
          </Link>
          <Link
            to="/guias"
            className="rounded-lg border border-border px-6 py-3 font-display text-sm uppercase tracking-widest transition hover:bg-secondary"
          >
            Ver os guias
          </Link>
        </div>

        <PublicLinks exclude="/dicas-de-gestao" />
      </div>
    </div>
  );
}
