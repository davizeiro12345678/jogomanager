import { Link } from "@tanstack/react-router";

import { ArticleShell, Section } from "@/components/ArticleShell";
import { GUIAS_PATH as PATH } from "@/lib/public-route-paths";

const GUIDES = [
  {
    id: "primeiro-clube",
    title: "Como escolher seu primeiro clube",
    body: "Clubes favoritos podem trazer mais pressão por resultados, enquanto projetos menores exigem paciência com o orçamento. Para uma estreia, compare metas da diretoria, posições disponíveis, calendário e finanças antes de escolher um clube.",
    extra:
      "A exigência real depende das regras e dos objetivos apresentados dentro da sua carreira.",
  },
  {
    id: "escalacao",
    title: "Escalação: o básico que ganha jogo",
    body: "Confira condição, posição e opções de substituição antes da partida. Se um atleta estiver cansado, considere um reserva e observe como o time muda em campo. Improvisos podem funcionar, mas aumentam o risco tático.",
    extra: "Confira a condição física antes de cada rodada, não só antes dos clássicos.",
  },
  {
    id: "tatica",
    title: "Tática: mentalidade, pressão e ritmo",
    body: "Escolha a postura pela capacidade do elenco e pelos espaços que o rival oferece. Pressionar mais à frente pode recuperar bolas, mas também expor a defesa. Observe criação, cobertura e condição física antes de alterar pressão ou ritmo.",
    extra:
      "Teste uma mudança por vez; força do adversário e mando não determinam uma tática vencedora.",
  },
  {
    id: "dinheiro",
    title: "Dinheiro: salários antes de contratações",
    body: "Antes de comprar, compare preço, salário, duração do compromisso e o saldo previsto para o restante da temporada. Confira a periodicidade dos valores na interface. Renovar ou substituir exige comparar o custo total das alternativas.",
    extra:
      "Um limite pessoal de gastos pode ajudar no planejamento, mas não existe uma porcentagem universal que determine automaticamente uma crise.",
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
    extra:
      "Confira as metas e os efeitos apresentados na sua carreira; não conte com orçamento futuro ainda não confirmado.",
  },
] as const;

const FAQ = [
  {
    q: "Preciso instalar alguma coisa para jogar?",
    a: "Não. O jogo roda direto no navegador, no computador ou no celular, e a carreira fica salva para você continuar depois.",
  },
  {
    q: "Qual clube é o melhor para começar?",
    a: "Escolha um clube que ofereça alternativas por posição e metas compatíveis com sua experiência. Verifique o orçamento e a cobrança real na tela de seleção.",
  },
  {
    q: "Dá para simular a partida em vez de assistir?",
    a: "Sim. Você pode acompanhar o jogo em 3D, acelerar a simulação ou pular direto para o resultado.",
  },
  {
    q: "Em quanto tempo consigo subir de divisão?",
    a: "Não existe prazo garantido. A campanha depende de adversários, desempenho, formato da competição e decisões ao longo da temporada.",
  },
] as const;

export function GuidesPage() {
  return (
    <ArticleShell
      kicker="Guias"
      title="Guias de manager de futebol"
      intro="Tudo que você precisa para comandar um clube: escolha do time, escalação, tática, finanças e relação com a diretoria. Depois de ler, é só assumir um clube e jogar direto no navegador."
      path={PATH}
      readMinutes={16}
      level="Iniciante"
      updated="13 de outubro de 2026"
      toc={[
        { id: "primeiros-passos", title: "Primeiras rodadas" },
        ...GUIDES.map((g) => ({ id: g.id, title: g.title })),
        { id: "diagnostico", title: "Diagnóstico do elenco" },
        { id: "plano-rodadas", title: "Plano de 10 rodadas" },
        { id: "exemplo-pratico", title: "Exemplo de decisão tática" },
        { id: "mercado-checklist", title: "Checklist de contratações" },
        { id: "erros-iniciantes", title: "Erros e como aprender" },
        { id: "salvamento", title: "Salvamento e backup" },
        { id: "primeira-sessao", title: "Primeira sessão com um objetivo claro" },
        { id: "proximo-guia", title: "Qual guia ler a seguir" },
      ]}
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
              to: "/melhores-formacoes",
              title: "Táticas e formações",
              detail: "Entenda o papel de cada setor e escolha um esquema para o seu elenco.",
            },
            {
              to: "/guia-de-scouting",
              title: "Scouting",
              detail: "Compare atletas por função, potencial e custo antes de negociar.",
            },
            {
              to: "/dicas-de-gestao",
              title: "Temporada e finanças",
              detail: "Planeje calendário, rodízio, custos e reserva de caixa.",
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

      <Section id="diagnostico" title="Como diagnosticar o elenco sem cair na armadilha do overall">
        <p>
          Antes de abrir o mercado, organize os atletas por posição e papel: goleiros, zagueiros,
          laterais, volantes, meias e atacantes. Não olhe apenas a nota geral. Um titular com
          overall alto pode render menos na sua estratégia se estiver fora da posição ou sem
          condições físicas adequadas.
        </p>
        <p>
          Monte uma tabela simples com titular, reserva, idade, condição e custo em cada setor. Se o
          clube possui atacantes fortes mas nenhum substituto para a lateral, a próxima contratação
          provavelmente deve reforçar a defesa. Já um time com poucas chances criadas precisa
          analisar se o problema é a armação, a movimentação ou a finalização antes de investir em
          mais um atacante.
        </p>
        <p>
          Compare seus jogadores com o estilo que você quer praticar. Pontas velozes favorecem
          amplitude; uma dupla de volantes confiável pode dar liberdade a um meia mais criativo.
          Confira os exemplos do{" "}
          <Link to="/guia-de-scouting" className="text-primary underline">
            guia de scouting
          </Link>
          .
        </p>
      </Section>

      <Section id="plano-rodadas" title="Plano de dez rodadas para entender sua equipe">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Rodadas 1 e 2:</strong> mantenha a escalação-base e
            identifique se o time sofre mais pelas laterais ou pelo centro.
          </li>
          <li>
            <strong className="text-foreground">Rodadas 3 e 4:</strong> ajuste um parâmetro tático
            de cada vez. Anote o efeito sobre a criação e a defesa.
          </li>
          <li>
            <strong className="text-foreground">Rodadas 5 e 6:</strong> planeje o uso do banco e
            reveja jogadores sobrecarregados ou improvisados.
          </li>
          <li>
            <strong className="text-foreground">Rodadas 7 e 8:</strong> estude as necessidades para
            a próxima janela, sem comprometer todo o caixa.
          </li>
          <li>
            <strong className="text-foreground">Rodadas 9 e 10:</strong> compare resultados contra
            adversários de níveis diferentes e escolha o principal ajuste do restante da temporada.
          </li>
        </ol>
        <p>
          Esse roteiro é um método de aprendizagem, não uma garantia de vitórias. Às vezes o melhor
          resultado surge de manter uma formação e permitir que a equipe execute um plano estável.
        </p>
      </Section>

      <Section id="exemplo-pratico" title="Exemplo: o que mudar quando você perde o meio-campo">
        <p>
          Situação ilustrativa: você usa um 4-3-3, mas o rival tem quatro jogadores participando das
          trocas de passe no centro. Seus pontas ficam isolados e o adversário recupera a bola
          rapidamente.
        </p>
        <p>
          Uma resposta possível é recuar um dos meias para apoiar a saída de bola ou testar um
          4-2-3-1, com dois volantes oferecendo proteção. A melhor escolha depende dos atributos
          disponíveis e da posição dos jogadores. Observe as chances criadas após a mudança; não
          conclua que a formação funcionou apenas porque um gol saiu em seguida.
        </p>
        <p>
          No{" "}
          <Link to="/melhores-formacoes" className="text-primary underline">
            comparativo de formações
          </Link>
          , você encontra os benefícios e os pontos frágeis de cada estrutura.
        </p>
      </Section>

      <Section id="mercado-checklist" title="Checklist antes de oferecer um contrato">
        <ul className="list-disc space-y-2 pl-5">
          <li>Essa posição é uma necessidade real ou você está contratando apenas pelo nome?</li>
          <li>O jogador pode assumir a função tática desejada sem exigir muitas improvisações?</li>
          <li>Salário e custo de aquisição deixam dinheiro para outras posições?</li>
          <li>Há risco de envelhecimento, lesão ou pouco tempo de contrato?</li>
          <li>Existe um reserva mais barato ou um atleta do próprio elenco capaz de resolver?</li>
        </ul>
        <p>
          Separe uma lista de prioridades em três faixas: essencial agora, útil na próxima janela e
          oportunidade futura. Esse processo reduz compras impulsivas. Saiba mais em
          <Link to="/mercado-de-transferencias" className="text-primary underline">
            mercado de transferências
          </Link>
          .
        </p>
      </Section>

      <Section id="erros-iniciantes" title="Cinco erros comuns e o que fazer em vez deles">
        <p>
          <strong className="text-foreground">Mudar tudo após uma derrota:</strong> altere uma ou
          duas decisões para descobrir o que realmente influenciou a partida.
        </p>
        <p>
          <strong className="text-foreground">Contratar só pelo overall:</strong> compare encaixe,
          posição, condição e custo.
        </p>
        <p>
          <strong className="text-foreground">Ignorar o banco:</strong> verifique alternativas antes
          da escalação, sobretudo em semanas com vários jogos.
        </p>
        <p>
          <strong className="text-foreground">Gastar a verba inteira:</strong> reserve margem para
          imprevistos e renovações.
        </p>
        <p>
          <strong className="text-foreground">Confundir tabela real com sua carreira:</strong> os
          resultados reais são referência informativa; sua temporada simulada tem andamento próprio.
        </p>
      </Section>

      <Section id="salvamento" title="Salvamento local, nuvem e cópia de segurança">
        <p>
          Jogando como convidado, o progresso pode depender dos dados mantidos pelo navegador. Antes
          de limpar o armazenamento ou mudar de aparelho, exporte a carreira quando a opção estiver
          disponível e confirme o estado da sincronização. Estar conectado à conta não é motivo para
          assumir que toda alteração já chegou ao servidor.
        </p>
        <p>
          Em caso de conflito entre duas versões, evite sobrescrever repetidamente o progresso;
          guarde as cópias e peça ajuda no{" "}
          <Link to="/contato" className="text-primary underline">
            suporte
          </Link>
          . Confira também{" "}
          <Link to="/jogar-offline" className="text-primary underline">
            o guia de carreira offline
          </Link>
          .
        </p>
      </Section>
      <Section
        id="primeira-sessao"
        title="Uma primeira sessão com um objetivo que você possa verificar"
      >
        <p>
          Em vez de tentar dominar todas as telas, termine a primeira sessão sabendo responder três
          perguntas: quem pode jogar em cada posição, qual é o próximo compromisso e onde o
          progresso está salvo. Essas respostas formam uma base para continuar a carreira sem
          depender de uma contratação imediata.
        </p>
        <p>
          Comece com as informações disponíveis na seleção e no elenco. Escolha uma formação que
          utilize posições naturais, confira o banco e acompanhe uma partida. Depois anote um setor
          que funcionou e outro que precisa de atenção. Não é necessário mudar tudo ao mesmo tempo
          para aprender; uma revisão pequena é mais fácil de avaliar.
        </p>
        <p>
          Se a apresentação em 3D estiver pesada no aparelho, confira os ajustes disponíveis e
          reduza a qualidade antes de uma sessão longa. Desempenho gráfico e decisão tática são
          problemas diferentes. Se o impedimento for um aviso de salvamento, preserve a carreira e
          use as{" "}
          <Link to="/jogar-offline" className="text-primary underline">
            orientações de backup
          </Link>{" "}
          antes de trocar de navegador.
        </p>
      </Section>
      <Section id="proximo-guia" title="Escolha a próxima leitura pelo problema da sua carreira">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            O time deixa espaços ou não cria chances? Continue em{" "}
            <Link to="/melhores-formacoes" className="text-primary underline">
              formações e diagnóstico tático
            </Link>
            .
          </li>
          <li>
            Falta um perfil específico? Use o{" "}
            <Link to="/guia-de-scouting" className="text-primary underline">
              método de scouting
            </Link>
            .
          </li>
          <li>
            Uma proposta parece barata, mas o salário preocupa? Compare o{" "}
            <Link to="/mercado-de-transferencias" className="text-primary underline">
              custo total da transferência
            </Link>
            .
          </li>
          <li>
            O calendário e o caixa estão difíceis de conciliar? Faça o{" "}
            <Link to="/dicas-de-gestao" className="text-primary underline">
              planejamento de temporada e finanças
            </Link>
            .
          </li>
          <li>
            O problema é acesso, compra ou conta? Consulte as{" "}
            <Link to="/perguntas-frequentes" className="text-primary underline">
              perguntas frequentes
            </Link>{" "}
            e o{" "}
            <Link to="/contato" className="text-primary underline">
              suporte
            </Link>
            .
          </li>
        </ul>
        <p>
          Cada guia aprofunda uma decisão própria. Use este roteiro como ponto de partida e volte
          aos artigos específicos conforme o problema aparecer; isso evita tentar aplicar todos os
          conselhos em uma única rodada.
        </p>
      </Section>
    </ArticleShell>
  );
}
