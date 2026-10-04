import { createFileRoute } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/comparativo-jogos-manager";
const TITLE = "Comparativo de jogos de manager | Pro Football Manager 3D";
const DESC =
  "Comparativo honesto entre jogos de manager de futebol: o que o Pro Football Manager 3D faz diferente, com partidas em 3D, clubes reais e jogo grátis no navegador.";

export const Route = createFileRoute("/comparativo-jogos-manager")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Comparativo de jogos de manager", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Comparativo", path: PATH },
      ]),
    ],
  }),
  component: ComparePage,
});

const ROWS: { feature: string; here: string; desktop: string; browser: string }[] = [
  {
    feature: "Preço",
    here: "Grátis, sem instalar",
    desktop: "Pago, por temporada",
    browser: "Grátis com anúncios",
  },
  {
    feature: "Partida em 3D",
    here: "Sim, com câmeras e narração",
    desktop: "Sim, motor completo",
    browser: "Normalmente só texto",
  },
  {
    feature: "Começar a jogar",
    here: "Segundos, direto no navegador",
    desktop: "Download e atualização",
    browser: "Cadastro obrigatório",
  },
  {
    feature: "Jogar offline",
    here: "Sim, carreira e partidas",
    desktop: "Sim",
    browser: "Não",
  },
  {
    feature: "Multiplayer",
    here: "1x1 por código de sala",
    desktop: "Rede/online",
    browser: "Ligas com muitos jogadores",
  },
  {
    feature: "Celular",
    here: "Feito para tela de toque",
    desktop: "Versão separada",
    browser: "Site adaptado",
  },
];

function ComparePage() {
  return (
    <ArticleShell
      kicker="Comparativo"
      title="Qual jogo de manager de futebol escolher"
      intro="Cada tipo de jogo de manager resolve um problema diferente. Veja onde este jogo se encaixa e quando outro formato faz mais sentido para você."
      path={PATH}
    >
      <div className="overflow-x-auto rounded-2xl border border-border/60 surface-card">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3 text-primary">Este jogo</th>
              <th className="p-3">Simulador de computador</th>
              <th className="p-3">Manager de navegador clássico</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.feature} className="border-t border-border/50">
                <td className="p-3 font-medium">{r.feature}</td>
                <td className="p-3 text-foreground">{r.here}</td>
                <td className="p-3 text-muted-foreground">{r.desktop}</td>
                <td className="p-3 text-muted-foreground">{r.browser}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Quando escolher um simulador de computador">
        <p>
          Se você quer profundidade máxima — comissão técnica detalhada, dezenas de atributos e
          bancos de dados com milhares de times — e não se importa em pagar e instalar.
        </p>
      </Section>
      <Section title="Quando escolher um manager de navegador clássico">
        <p>
          Se o que te atrai é a competição contra centenas de pessoas em ligas longas, com poucos
          minutos por dia e sem partida em 3D.
        </p>
      </Section>
      <Section title="Quando escolher este jogo">
        <p>
          Se você quer abrir e jogar na hora, ver a partida em 3D com narração, gerenciar uma
          carreira completa e continuar jogando mesmo sem internet — no celular ou no computador.
        </p>
      </Section>
      <Section title="Experimente antes de escolher">
        <p>
          Compare os controles, a clareza da interface e o tempo que você pretende dedicar a cada
          sessão. Uma partida rápida ajuda a conhecer a apresentação em 3D; uma carreira permite
          avaliar o planejamento de elenco, o calendário e as decisões entre jogos. No celular,
          confira também os ajustes de qualidade gráfica para encontrar uma configuração confortável
          para seu aparelho.
        </p>
      </Section>
    </ArticleShell>
  );
}
