import { createFileRoute, Link } from "@tanstack/react-router";
import { ArticleShell, Section } from "@/components/ArticleShell";
import { FORMATIONS } from "@/game/formations";
import type { FormationKey } from "@/game/types";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/taticas-e-formacoes";
const TITLE = "Táticas e formações: guia de futebol | Pro Football Manager 3D";
const DESC =
  "Compare as quatro formações disponíveis no Pro Football Manager 3D, confira as funções de cada posição e use pressão, amplitude e ritmo para ajustar seu plano de jogo.";
export const Route = createFileRoute("/taticas-e-formacoes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article", keywords: [] }),
    links: canonical(PATH),
    scripts: [
      articleLd({
        headline: "Como escolher e ajustar sua formação",
        description: DESC,
        path: PATH,
      }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Táticas e formações", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const PLANS = [
  {
    name: "4-3-3",
    need: "Dois pontas, um centroavante e três meio-campistas, incluindo um volante.",
    advantage:
      "Os pontas oferecem opções pelos lados; o volante é a referência central à frente da defesa.",
    risk: "Se as jogadas adversárias entram pelos lados, observe a cobertura dos laterais antes de aumentar a pressão.",
    test: "Confira se os pontas recebem em condições de avançar e se o centroavante tem apoio dos meias.",
  },
  {
    name: "4-4-2",
    need: "Dois atacantes, dois meias centrais e dois meias pelos lados.",
    advantage: "Mantém duas referências na frente e distribui o meio em uma linha de quatro.",
    risk: "Os dois meias centrais podem ficar sem uma opção curta contra um adversário que concentra jogadores no meio.",
    test: "Observe se os atacantes participam das jogadas ou ficam isolados. Ajuste o ritmo antes de abandonar o esquema.",
  },
  {
    name: "3-5-2",
    need: "Três zagueiros, dois alas, dois volantes, um meia e dois atacantes.",
    advantage: "Oferece uma referência entre as linhas e alas como opções de amplitude.",
    risk: "O espaço atrás dos alas merece atenção nas transições; a formação exige alternativas no banco para essas funções.",
    test: "Veja por qual lado surgem as chances adversárias e confira a condição dos alas antes de pedir mais intensidade.",
  },
  {
    name: "4-2-3-1",
    need: "Dois volantes, um meia central avançado, dois meias pelos lados e um centroavante.",
    advantage: "Separa uma dupla de proteção no meio das três opções de apoio ao atacante.",
    risk: "O centroavante pode ficar sozinho quando os meias não conseguem aproximar o jogo.",
    test: "Observe se o meia encontra o atacante e se há uma opção de passe pelos lados. Mais mentalidade ofensiva não corrige toda falta de conexão.",
  },
] satisfies { name: FormationKey; need: string; advantage: string; risk: string; test: string }[];

function Page() {
  return (
    <ArticleShell
      kicker="Decisões em campo"
      title="Como escolher e ajustar sua formação"
      intro="Comece pelas funções que seu elenco consegue preencher. Este guia usa os quatro esquemas disponíveis no jogo e propõe observações para revisar sua escolha; nenhum desenho garante vitória."
      path={PATH}
      updated="outubro de 2026"
      toc={[
        { id: "comparar", title: "Compare as posições" },
        ...PLANS.map((plan) => ({ id: `f${plan.name.replaceAll("-", "")}`, title: plan.name })),
        { id: "ajustes", title: "Use os controles reais" },
        { id: "diagnostico", title: "Diagnóstico durante a partida" },
        { id: "teste", title: "Avalie seu plano" },
      ]}
    >
      <section id="comparar" className="scroll-mt-24">
        <h2 className="font-display text-2xl">Compare as posições antes de escalar</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          A distribuição abaixo vem das posições usadas pelo próprio jogo. GOL é goleiro, ZAG é
          zagueiro, VOL é volante, ALA atua pelo lado e CA é centroavante.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Posições das quatro formações disponíveis</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Esquema
                </th>
                <th scope="col" className="p-3">
                  Funções na escalação
                </th>
              </tr>
            </thead>
            <tbody>
              {PLANS.map((plan) => (
                <tr key={plan.name} className="border-t border-border">
                  <th scope="row" className="p-3">
                    {plan.name}
                  </th>
                  <td className="p-3 text-muted-foreground">
                    {FORMATIONS[plan.name].map((slot) => slot.label).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {PLANS.map((plan) => (
        <Section key={plan.name} id={`f${plan.name.replaceAll("-", "")}`} title={plan.name}>
          <p>
            <strong>Elenco necessário:</strong> {plan.need}
          </p>
          <p>
            <strong>O que o desenho oferece:</strong> {plan.advantage}
          </p>
          <p>
            <strong>Ponto de atenção:</strong> {plan.risk}
          </p>
          <p>
            <strong>O que observar:</strong> {plan.test}
          </p>
        </Section>
      ))}
      <Section id="ajustes" title="O que os controles permitem ajustar">
        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-foreground">Mentalidade</dt>
            <dd>
              Escolha o grau de cautela ou iniciativa. Antes de elevar a agressividade, confira se
              há jogadores para apoiar o ataque sem deixar a defesa descoberta.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Pressão</dt>
            <dd>
              As opções vão de bloco baixo a pressão alta. Observe onde o time disputa a bola e se
              consegue acompanhar os deslocamentos do adversário.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Amplitude</dt>
            <dd>
              Estreito, padrão ou aberto. Considere abrir quando faltam opções pelos lados e
              estreitar quando os jogadores precisam se aproximar para trocar passes.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Ritmo</dt>
            <dd>
              Lento, padrão ou acelerado. Reveja a escolha quando a equipe força passes ou quando
              circula a bola sem avançar.
            </dd>
          </div>
        </dl>
        <p>
          A formação define as posições de referência. Pressão, amplitude, ritmo e mentalidade
          completam o plano; mudar todos os controles de uma vez dificulta entender o efeito de cada
          decisão.
        </p>
      </Section>
      <Section id="diagnostico" title="Leia o problema antes de mexer no intervalo">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <strong>Posse sem chances:</strong> observe onde a jogada termina. Falta de apoio ao
            atacante pede uma revisão das opções de passe; passes precipitados pedem uma revisão do
            ritmo.
          </li>
          <li>
            <strong>Chances cedidas pelos lados:</strong> confira quem está cobrindo o setor e a
            condição dos jogadores envolvidos. Não aumente a pressão apenas porque está perdendo.
          </li>
          <li>
            <strong>Time cansado:</strong> examine o banco e substitua por função. Ao mudar para
            três zagueiros, confirme que existe um terceiro defensor disponível.
          </li>
          <li>
            <strong>Vantagem no placar:</strong> mantenha uma saída para o ataque. Recuar toda a
            equipe pode deixar o adversário atacar repetidamente.
          </li>
        </ul>
      </Section>
      <Section id="teste" title="Como avaliar se a escolha está funcionando">
        <p>
          Anote o esquema, o problema observado e uma alteração feita. Compare a criação de chances,
          as finalizações e a condição física em mais de uma partida, considerando a força dos
          adversários. Um placar isolado não demonstra que uma formação é superior.
        </p>
        <p>
          Use uma{" "}
          <Link to="/partida-rapida" className="text-primary underline">
            partida rápida
          </Link>{" "}
          para conhecer a distribuição em campo. Na carreira, faça a revisão com os jogadores que
          você realmente tem e consulte a{" "}
          <Link to="/guias" className="text-primary underline">
            guia de carreira e rotina entre rodadas
          </Link>{" "}
          para preparar o elenco.
        </p>
      </Section>
    </ArticleShell>
  );
}
