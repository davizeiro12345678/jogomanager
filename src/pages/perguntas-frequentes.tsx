import { Link } from "@tanstack/react-router";
import { SHIPPED_CATALOG } from "@/game/data/catalog-facts";

import { PublicLinks } from "@/components/PublicLinks";

import { CommunityInvite } from "@/components/CommunityInvite";
import { PERGUNTAS_FREQUENTES_PATH as PATH } from "@/lib/public-route-paths";

const GROUPS = [
  {
    id: "comecar",
    title: "Começar a jogar",
    questions: [
      {
        q: "O Pro Football Manager 3D é gratuito?",
        a: "O jogo oferece acesso gratuito para começar a carreira e experimentar partidas. A loja apresenta produtos opcionais; confira o preço, a descrição e as condições de cada item antes da compra.",
      },
      {
        q: "Preciso instalar algo para jogar?",
        a: "Não. A experiência principal funciona no navegador. Uma conexão e um dispositivo compatíveis são recomendados para partidas em 3D e sincronização.",
      },
      {
        q: "Posso jogar sem criar uma conta?",
        a: "É possível começar como convidado. Nesse caso, o progresso depende do armazenamento mantido no navegador. Uma conta habilita os recursos de nuvem disponíveis.",
      },
      {
        q: "Funciona em celulares e computadores?",
        a: "O site é acessível em dispositivos móveis e desktop. A fluidez das partidas 3D varia com a GPU, a memória, o navegador e as opções gráficas selecionadas.",
      },
      {
        q: "Qual modo devo experimentar primeiro?",
        a: "Uma partida rápida ajuda a conhecer a visualização 3D. A carreira de treinador é indicada para quem quer administrar elenco, táticas, contratações e temporadas.",
      },
    ],
  },
  {
    id: "carreira",
    title: "Carreiras, clubes e competições",
    questions: [
      {
        q: "Os clubes e jogadores são reais?",
        a: "A plataforma reúne dados de clubes, atletas e competições reais obtidos de fontes esportivas. Os dados podem ter lacunas ou diferenças de atualização; nem todo registro do catálogo é necessariamente jogável em todos os modos.",
      },
      {
        q: "Por que a quantidade de clubes do catálogo difere da tela de carreira?",
        a: `O catálogo incluído reúne ${SHIPPED_CATALOG.competitions} competições e ${SHIPPED_CATALOG.playableClubs} clubes únicos. Registros importados no aparelho podem ampliar as opções; cada carreira mantém a composição compatível com sua temporada.`,
      },
      {
        q: "Posso escolher clubes de vários países?",
        a: "Existem clubes e competições de diferentes países na base. A disponibilidade depende do modo, dos dados importados e do suporte da competição dentro da carreira.",
      },
      {
        q: "Como escolho minha primeira equipe?",
        a: "Veja o objetivo da diretoria, o orçamento, as opções por posição e o nível dos adversários. Um time intermediário costuma oferecer um desafio diferente de um favorito ao título.",
      },
      {
        q: "Qual é a melhor formação?",
        a: "Não existe um esquema que vence sempre. Compare pontas, volantes, zagueiros, laterais e as fraquezas do adversário antes de decidir. Ajustes táticos devem ser avaliados ao longo de várias partidas.",
      },
      {
        q: "O que são overall e potencial?",
        a: "Overall resume uma avaliação atual; potencial representa uma estimativa de crescimento. Nenhuma das duas medidas substitui a análise da função tática, do custo e da condição do atleta.",
      },
      {
        q: "Dá para assistir a toda a partida em 3D?",
        a: "O jogo possui visualização de partidas em 3D e opções de simulação. Disponibilidade e desempenho variam conforme o modo, o navegador e o dispositivo.",
      },
    ],
  },
  {
    id: "salvamento",
    title: "Salvamento, nuvem e modo offline",
    questions: [
      {
        q: "Como minha carreira é salva?",
        a: "A carreira de convidado utiliza armazenamento local. Ao entrar numa conta, há recursos de sincronização com a nuvem quando a conexão e os serviços estão disponíveis. Confira sempre o estado da sincronização.",
      },
      {
        q: "Posso continuar no computador após jogar no celular?",
        a: "A sincronização entre aparelhos depende de conta, conectividade e conclusão do envio dos dados. Confirme o progresso salvo antes de trocar de dispositivo.",
      },
      {
        q: "Posso jogar offline?",
        a: "Algumas funções podem operar sem conexão após o carregamento inicial. Importações, autenticação, multiplayer, pagamentos e atualizações precisam de acesso aos serviços online.",
      },
      {
        q: "Posso apagar os dados do navegador sem perder minha carreira?",
        a: "Antes de limpar os dados, abra Perfil do treinador (/perfil), escolha Exportar carreira, confira clube, temporada, rodada, data e versão e baixe o arquivo .pfm3d.json. Teste a cópia em outro perfil do navegador: escolha Importar carreira, revise o arquivo e confirme a restauração. Confira elenco, finanças, calendário e histórico antes de apagar o original. O arquivo do editor contém apenas personalizações e não recupera seu progresso.",
      },
      {
        q: "O que faço se uma carreira antiga aparecer de novo?",
        a: "Evite substituir arquivos repetidas vezes. Guarde cópias, anote clube, temporada e dispositivo, e informe o problema ao suporte. Isso ajuda a investigar conflitos entre saves locais e remotos.",
      },
    ],
  },
  {
    id: "online",
    title: "Multiplayer e comunidade",
    questions: [
      {
        q: "Como funciona o multiplayer?",
        a: "O modo inclui a criação de salas e compartilhamento de convite com outros jogadores. Confira na tela do multiplayer as regras e os recursos disponíveis na versão atual.",
      },
      {
        q: "Preciso de internet para enfrentar amigos?",
        a: "Sim. Sessões compartilhadas dependem da comunicação com serviços online; uma partida local ou offline não substitui uma conexão multiplayer.",
      },
      {
        q: "Onde posso encontrar outros treinadores?",
        a: "A comunidade pode ser acessada pelos convites oficiais apresentados no site. Não compartilhe senhas, códigos privados ou dados de pagamento em chats.",
      },
    ],
  },
  {
    id: "suporte",
    title: "Compras, suporte e privacidade",
    questions: [
      {
        q: "A loja é obrigatória para disputar partidas?",
        a: "Não é necessário comprar um produto para começar gratuitamente. Antes de qualquer compra opcional, confira o efeito real do item, a forma de pagamento e as condições exibidas.",
      },
      {
        q: "Paguei, mas não recebi o produto. O que faço?",
        a: "Confira o status do pedido e a conta utilizada. Se a entrega não aparecer, contate o suporte com o número do pedido. Não compartilhe dados completos do cartão nem senha.",
      },
      {
        q: "Como solicito suporte ou faço uma sugestão?",
        a: "Use a página de contato. Informe dispositivo, navegador, página, ação realizada e resultado encontrado. Para problemas de carreira, inclua clube, temporada e rodada.",
      },
      {
        q: "Posso pedir acesso ou exclusão dos meus dados?",
        a: "A política de privacidade explica os tipos de informações tratados e os canais para solicitações sobre seus dados pessoais.",
      },
      {
        q: "Como acompanho novidades do jogo?",
        a: "A página do criador reúne atualizações do desenvolvimento. Consulte também os canais oficiais antes de considerar uma funcionalidade experimental como concluída.",
      },
    ],
  },
] as const;

export function Page() {
  return (
    <main className="pitch-bg min-h-screen px-4 py-14">
      <article className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Ajuda</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Perguntas frequentes sobre o jogo
        </h1>
        <p className="mt-4 text-muted-foreground">
          Entenda como começar, escolher o clube, acompanhar partidas em 3D, proteger o progresso da
          carreira e resolver problemas. As respostas explicam o que verificar; a disponibilidade de
          cada recurso pode variar com a versão e o modo de jogo.
        </p>

        <nav
          aria-label="Navegar por assuntos"
          className="mt-8 rounded-xl border border-border/60 surface-card p-5"
        >
          <h2 className="font-display text-lg">Encontre o assunto</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className="text-sm text-primary underline underline-offset-4"
                >
                  {group.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {GROUPS.map((group) => (
          <section id={group.id} key={group.id} className="mt-12 scroll-mt-24">
            <h2 className="font-display text-2xl">{group.title}</h2>
            <dl className="mt-5 space-y-4">
              {group.questions.map(({ q, a }) => (
                <div key={q} className="rounded-xl border border-border/60 surface-card p-4">
                  <dt className="font-display text-lg">{q}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="mt-12 rounded-xl border border-primary/30 surface-card p-5">
          <h2 className="font-display text-xl">Guias para ir além das respostas rápidas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Veja exemplos de escalação, scouting e planejamento financeiro. Para sua primeira
            temporada, siga os passos do guia completo e compare as principais formações.
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <Link className="text-primary underline" to="/guias">
              Guias do treinador
            </Link>
            <Link className="text-primary underline" to="/melhores-formacoes">
              Táticas e formações
            </Link>
            <Link className="text-primary underline" to="/jogar-offline">
              Salvamento offline
            </Link>
            <Link className="text-primary underline" to="/contato">
              Contato e suporte
            </Link>
          </div>
        </section>

        <div className="mt-10">
          <Link
            to="/new"
            className="inline-flex rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar a jogar
          </Link>
        </div>
        <CommunityInvite compact />
        <PublicLinks exclude={PATH} />
      </article>
    </main>
  );
}
