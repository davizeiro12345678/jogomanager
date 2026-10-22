import { Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { MELHORES_FORMACOES_PATH as PATH } from "@/lib/public-route-paths";

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
];

export function FormationsPage() {
  return (
    <ArticleShell
      kicker="Táticas"
      title="Melhores formações e quando usar cada uma"
      intro="Não existe formação perfeita — existe a formação certa para o seu elenco e para o adversário da rodada. Veja o que cada esquema entrega e o que ele cobra."
      path={PATH}
      readMinutes={16}
      level="Iniciante"
      updated="13 de outubro de 2026"
      toc={[
        { id: "comparar-formacoes", title: "Compare os quatro esquemas" },
        ...FORMATIONS.map((f) => ({ id: f.name, title: f.name })),
        { id: "escolher", title: "Como escolher na prática" },
        { id: "ajustes", title: "Os três ajustes que mais mudam o jogo" },
        { id: "intervalo", title: "O que mexer no intervalo" },
        { id: "diagnostico", title: "Diagnóstico tático" },
        { id: "exemplos", title: "Três cenários de jogo" },
        { id: "comparar", title: "Como testar mudanças" },
        { id: "mapa", title: "Mapa de problemas e ajustes" },
        { id: "banco", title: "Banco e plano alternativo" },
        { id: "registro", title: "Registro de uma experiência tática" },
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
      <Section id="comparar-formacoes" title="Compare quatro formações para o seu elenco">
        {FORMATIONS.map((f) => (
          <Section key={f.name} id={f.name} title={f.name} level={3}>
            <p>
              <strong className="text-foreground">Forte em:</strong> {f.good}
            </p>
            <p>
              <strong className="text-foreground">Cuidado com:</strong> {f.bad}
            </p>
          </Section>
        ))}
      </Section>
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
            <strong className="text-foreground">Mentalidade</strong> orienta a postura geral do
            time. Uma opção mais ofensiva pode aumentar a presença no ataque, mas exige atenção aos
            espaços deixados para trás.
          </li>
          <li>
            <strong className="text-foreground">Altura da linha</strong> influencia o espaço atrás
            da defesa. Linha alta pode pressionar mais à frente, mas permite ataques às costas dos
            zagueiros.
          </li>
          <li>
            <strong className="text-foreground">Ritmo</strong> muda a velocidade pretendida das
            ações. Acompanhe a condição física e evite presumir que acelerar sempre produzirá mais
            chances.
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
          Repare em quatro perguntas: o adversário chega pela lateral ou pelo centro? Seus volantes
          conseguem proteger a entrada da área? Seus atacantes recebem a bola em condições de
          finalizar? A equipe consegue recuperar a posse sem abrir espaços?
        </p>
        <p>
          Uma formação desenha posições de partida, mas a qualidade do plano depende de quem ocupa
          cada função. Um 4-3-3 com pontas que retornam para marcar pode oferecer equilíbrio
          diferente de um 4-3-3 que mantém os três atacantes adiantados. Por isso, evite comparar
          apenas os números da formação.
        </p>
      </Section>
      <Section id="exemplos" title="Três cenários táticos para estudar">
        <h3 className="font-display text-base text-foreground">
          Cenário A: pontas velozes, meio-campo limitado
        </h3>
        <p>
          No 4-3-3, a equipe pode explorar profundidade pelos lados, mas precisa proteger o setor
          central. Se o adversário acumula jogadores por dentro, experimente apoio adicional de um
          volante ou um ajuste da pressão, sem trocar tudo de uma só vez.
        </p>
        <h3 className="font-display text-base text-foreground">
          Cenário B: dois volantes fortes e um armador
        </h3>
        <p>
          O 4-2-3-1 permite distribuir responsabilidade defensiva na frente dos zagueiros e deixar
          um meia mais livre para organizar. Analise se o centroavante está isolado e se os extremos
          conseguem participar da criação.
        </p>
        <h3 className="font-display text-base text-foreground">
          Cenário C: vantagem pequena no fim da partida
        </h3>
        <p>
          Recuar a linha pode proteger a área, mas também entregar o meio-campo ao rival. Antes de
          mudar a organização defensiva, observe o perfil dos substitutos, o desgaste físico e de
          onde vêm as oportunidades do adversário.
        </p>
        <p>
          Esses exemplos ensinam raciocínio tático: os resultados específicos precisam ser testados
          na sua versão do simulador.
        </p>
      </Section>
      <Section id="comparar" title="Como testar se uma mudança tática realmente funcionou">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Comece com uma formação que aproveite os melhores jogadores nas posições naturais.
          </li>
          <li>Observe duas ou três partidas, levando em conta a força dos adversários.</li>
          <li>Altere uma variável: formação, mentalidade, linha ou substituições.</li>
          <li>Compare oportunidades criadas, espaços defensivos e desgaste dos atletas.</li>
          <li>
            Evite concluir que uma tática é superior com base em apenas uma vitória ou derrota.
          </li>
        </ol>
        <p>
          Para construir o elenco adequado ao seu plano, use o
          <Link to="/guia-de-scouting" className="text-primary underline">
            {" "}
            guia de scouting
          </Link>
          e organize as contratações com o
          <Link to="/mercado-de-transferencias" className="text-primary underline">
            guia de transferências
          </Link>
          .
        </p>
      </Section>
      <Section id="mapa" title="Relacione o problema observado com um ajuste possível">
        <p>
          O primeiro passo é descrever onde o time falha. Sofrer uma finalização não significa
          automaticamente precisar de mais defensores; a origem pode ser uma perda de bola no meio,
          um lateral sem cobertura ou um atacante que não oferece saída. Identifique a sequência
          antes de escolher o controle que pretende alterar.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Hipóteses táticas para observar em partidas</caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  Problema
                </th>
                <th scope="col" className="p-3">
                  Pergunta
                </th>
                <th scope="col" className="p-3">
                  Teste possível
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/50">
                <th scope="row" className="p-3">
                  Espaço atrás da defesa
                </th>
                <td className="p-3">A linha está alta para os jogadores disponíveis?</td>
                <td className="p-3">Revisar altura e cobertura mantendo os demais ajustes.</td>
              </tr>
              <tr className="border-t border-border/50">
                <th scope="row" className="p-3">
                  Centroavante isolado
                </th>
                <td className="p-3">Quem conecta o meio à área?</td>
                <td className="p-3">Rever o perfil do armador ou a organização do apoio.</td>
              </tr>
              <tr className="border-t border-border/50">
                <th scope="row" className="p-3">
                  Perdas frequentes no centro
                </th>
                <td className="p-3">Há opções de passe e proteção próximas?</td>
                <td className="p-3">Rever o equilíbrio do meio antes de acelerar o ritmo.</td>
              </tr>
              <tr className="border-t border-border/50">
                <th scope="row" className="p-3">
                  Queda no fim do jogo
                </th>
                <td className="p-3">É desgaste, substituição ou mudança do rival?</td>
                <td className="p-3">Comparar condição e minutos antes de alterar o sistema.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          A tabela apresenta hipóteses de observação. Nenhum ajuste garante a correção, e uma
          vitória isolada não confirma a causa. Veja se o problema reaparece em contextos
          comparáveis e se a mudança também criou uma nova vulnerabilidade.
        </p>
      </Section>
      <Section id="banco" title="Prepare um plano alternativo que o banco consiga executar">
        <p>
          O plano B deve usar jogadores que você realmente tem. Trocar um 4-3-3 por 4-4-2 exige
          considerar quem forma a dupla de ataque e quem ocupa as faixas do meio. Um desenho que
          depende de dois atletas indisponíveis não é uma alternativa prática. Confira também quem
          pode entrar sem improvisação e quem precisa de recuperação.
        </p>
        <p>
          Antes da partida, pense em três estados: vantagem pequena, placar empatado e necessidade
          de buscar um gol. Para cada um, anote uma mudança possível, o jogador necessário e o risco
          associado. Isso evita confirmar várias alterações no impulso quando o placar muda.
          Reavalie conforme o comportamento do adversário.
        </p>
        <p>
          O calendário pode limitar suas opções: preservar um atleta agora altera o banco do
          confronto seguinte. Relacione o plano tático ao
          <Link to="/dicas-de-gestao" className="text-primary underline">
            {" "}
            guia de rodízio e temporada
          </Link>
          e use o{" "}
          <Link to="/guia-de-scouting" className="text-primary underline">
            {" "}
            scouting
          </Link>
          para identificar funções sem cobertura.
        </p>
      </Section>
      <Section id="registro" title="Como registrar uma experiência tática útil">
        <p>
          Anote formação, titulares, condição física, adversário e a mudança testada. Depois
          registre o que observou: de onde saíram as chances, quais setores ficaram expostos e
          quando o desempenho caiu. Se a interface não apresenta uma métrica, descreva os lances
          observados em vez de inventar números.
        </p>
        <p>
          Um exemplo de anotação seria: mantive o 4-2-3-1 e reduzi a altura da linha; o rival
          encontrou menos espaço atrás dos zagueiros, mas passou a receber mais perto da área. A
          próxima observação deve investigar essa troca. Essa análise é mais útil do que concluir
          apenas que a nova formação ganhou ou perdeu.
        </p>
      </Section>
    </ArticleShell>
  );
}
