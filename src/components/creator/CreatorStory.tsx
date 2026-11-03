/**
 * Conteúdo editorial da página do criador: como o jogo é feito e por quê.
 * Só descreve recursos que existem no projeto; números vêm das fontes do jogo.
 */
import { Link } from "@tanstack/react-router";

import { FAQ_COUNT } from "@/content/faq";
import { CHANGELOG } from "@/content/changelog";
import { STORE_PACKS } from "@/game/store-catalog";

const PILLARS: { title: string; body: string }[] = [
  {
    title: "Grátis e sem instalação",
    body: "O jogo abre direto no navegador, no celular ou no computador. A ideia é que qualquer pessoa consiga começar uma carreira em segundos, sem baixar arquivos pesados nem depender de uma loja de aplicativos.",
  },
  {
    title: "Decisão antes de efeito",
    body: "A prioridade é que cada escolha do treinador pese no resultado. Gráficos, câmeras e cenas vêm depois e nunca podem atrapalhar a leitura do jogo ou a fluidez num aparelho intermediário.",
  },
  {
    title: "Resultado justo e verificável",
    body: "A simulação é determinística: os mesmos dados produzem o mesmo resultado. Isso deixa os replays fiéis, impede que o aparelho mais lento perca a partida e permite conferir no servidor os placares do multiplayer.",
  },
  {
    title: "Progresso protegido",
    body: "A carreira fica salva no aparelho e, com conta, também na nuvem. A nuvem recusa um save mais antigo que o já guardado, e as conquistas permanentes são decididas pelo servidor a partir de progresso verificável.",
  },
];

const TECH_ROWS: { part: string; choice: string; why: string }[] = [
  {
    part: "Simulação da partida",
    choice: "Motor próprio, determinístico, rodando em segundo plano",
    why: "Calcula lance a lance sem travar a tela e produz sempre o mesmo resultado para os mesmos dados.",
  },
  {
    part: "Visual da partida",
    choice: "3D no navegador com qualidade automática",
    why: "Ajusta resolução, sombras e efeitos ao aparelho para manter a partida fluida também em celulares intermediários.",
  },
  {
    part: "Física visual",
    choice: "Física de corpos rígidos apenas para o visual",
    why: "Bola, rede e contatos ganham realismo sem alterar as regras, que continuam no motor determinístico.",
  },
  {
    part: "Temporada automática",
    choice: "Simulação sequencial semana a semana",
    why: "Cada semana depende da anterior; manter a ordem preserva resultados reproduzíveis.",
  },
  {
    part: "Salvamento",
    choice: "Local no aparelho + nuvem opcional com conta",
    why: "Permite jogar offline e continuar em outro aparelho sem que um save antigo sobrescreva o recente.",
  },
  {
    part: "Pagamentos",
    choice: "Checkout seguro da Stripe com validação no servidor",
    why: "Os itens só são entregues depois da confirmação assinada do pagamento e pelo preço oficial do catálogo.",
  },
];

const MODES: { name: string; session: string; focus: string; online: string }[] = [
  {
    name: "Partida rápida",
    session: "10 a 20 minutos",
    focus: "Conhecer o 3D, a narração e a leitura tática de uma partida",
    online: "Não, depois do primeiro carregamento",
  },
  {
    name: "Carreira de treinador",
    session: "De uma rodada a uma temporada inteira",
    focus: "Elenco, mercado, treino, finanças e objetivos da diretoria",
    online: "Não; com conta, sincroniza quando houver conexão",
  },
  {
    name: "Temporada automática",
    session: "Poucos minutos por temporada",
    focus: "Avançar rápido e interferir só nas decisões importantes",
    online: "Não",
  },
  {
    name: "Multiplayer",
    session: "Uma partida por desafio",
    focus: "Enfrentar outro treinador com resultado conferido no servidor",
    online: "Sim, durante toda a sessão",
  },
];

const CREATOR_FAQ: { q: string; a: string }[] = [
  {
    q: "O jogo é feito por uma empresa grande?",
    a: "Não. É um projeto independente, criado e mantido por Davi Andrian Thomazini. As decisões de design, as correções e as novidades saem da mesma pessoa, com ajuda do retorno da comunidade.",
  },
  {
    q: "O jogo tem relação com outros jogos de manager famosos?",
    a: "Não. O Pro Football Manager 3D é uma criação própria, com motor, interface e regras desenvolvidos para rodar no navegador. Comparações com outros jogos do gênero estão no comparativo do site.",
  },
  {
    q: "Com que frequência sai atualização?",
    a: "As melhorias saem em entregas frequentes e menores, registradas na linha do tempo desta página. Cada entrega passa pelas verificações de estabilidade e desempenho antes de ir ao ar.",
  },
  {
    q: "Posso sugerir uma liga, um clube ou um recurso?",
    a: "Pode e deve. Envie pela comunidade ou pelo e-mail do criador, explicando o que você gostaria de ver e por quê. Pedidos com exemplos concretos ajudam a priorizar.",
  },
  {
    q: "Como reporto um erro de forma útil?",
    a: "Diga o aparelho, o navegador, a página, o passo a passo do que fez e o que aconteceu. Se for na carreira, inclua clube, temporada e rodada. Uma captura de tela ajuda muito.",
  },
  {
    q: "O jogo vai continuar gratuito?",
    a: "Sim. A proposta é manter a carreira e as partidas acessíveis de graça; a loja é opcional e financia servidores, dados esportivos e desenvolvimento.",
  },
];

export function CreatorStory() {
  const updates = CHANGELOG.reduce((total, entry) => total + entry.items.length, 0);

  return (
    <article className="mt-12 space-y-12 text-[15px] leading-relaxed text-muted-foreground">
      <section aria-labelledby="why" className="space-y-4">
        <h2 id="why" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Por que este jogo existe
        </h2>
        <p>
          O Pro Football Manager 3D nasceu de uma vontade simples: ter um manager de futebol
          completo, gratuito e bonito que rode em qualquer aparelho, sem instalação. Muitos jogos
          de gestão exigem computador potente, download grande ou compra antecipada. Outros são
          leves, mas parecem planilhas e não mostram o jogo acontecendo. A proposta aqui é juntar
          as duas coisas: profundidade de gestão e uma partida em 3D que você assiste e entende.
        </p>
        <p>
          O projeto é desenvolvido de forma independente, por uma única pessoa, como criação
          autoral. Isso explica algumas escolhas: o foco em recursos que realmente mudam a
          experiência, as atualizações frequentes em vez de grandes lançamentos raros e a
          conversa direta com quem joga, pela comunidade e pelos canais do criador.
        </p>
      </section>

      <section aria-labelledby="pillars" className="space-y-4">
        <h2 id="pillars" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Os quatro princípios do projeto
        </h2>
        <p>
          Toda nova funcionalidade passa por quatro perguntas. Se uma ideia não respeita esses
          princípios, ela é adiada ou redesenhada, mesmo que pareça atraente à primeira vista.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <section key={pillar.title} className="rounded-2xl border border-border/60 surface-card p-5">
              <h3 className="font-display text-lg text-foreground">{pillar.title}</h3>
              <p className="mt-2 text-sm">{pillar.body}</p>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Como o jogo é construído
        </h2>
        <p>
          Por trás da tela existe uma divisão clara de responsabilidades. O motor de simulação
          decide o que acontece em campo; o 3D só desenha. Essa separação é o que permite
          acelerar uma partida, pular para o resultado ou assistir ao jogo inteiro sem que o
          placar mude. Também é o que permite reduzir a qualidade gráfica num celular mais simples
          sem tirar nada da partida em si.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <caption className="sr-only">Partes técnicas do jogo e o motivo de cada escolha</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Parte</th>
                <th scope="col" className="p-3">Escolha</th>
                <th scope="col" className="p-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {TECH_ROWS.map((row) => (
                <tr key={row.part} className="border-t border-border/60 align-top">
                  <th scope="row" className="p-3 font-medium text-foreground">{row.part}</th>
                  <td className="p-3">{row.choice}</td>
                  <td className="p-3">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          O desempenho é tratado como requisito, não como detalhe. Antes de uma versão ir ao ar,
          ela passa por uma bateria de verificações automáticas, incluindo centenas de partidas
          simuladas em sequência para garantir estabilidade, limites de tamanho do carregamento
          inicial e testes que conferem que o resultado continua idêntico para os mesmos dados.
        </p>
      </section>

      <section aria-labelledby="world" className="space-y-4">
        <h2 id="world" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Um mundo de futebol que não para de crescer
        </h2>
        <p>
          A base do jogo reúne mais de 100 ligas e mais de 1.300 clubes, com escudos, uniformes e
          cores próprias, montada a partir de dados esportivos reais e atualizada em lotes. As
          ligas nacionais seguem uma pirâmide com acesso e rebaixamento resolvidos ao mesmo
          tempo no fim da temporada, mantendo o número de clubes de cada divisão.
        </p>
        <p>
          A interface fala 39 idiomas e detecta o idioma do navegador automaticamente. A narração
          ao vivo das partidas está em português, inglês e espanhol. As tabelas das principais
          ligas do mundo também ficam disponíveis no site, como em{" "}
          <Link to="/tabelas" className="text-primary hover:underline">tabelas das ligas</Link>, para
          quem quer acompanhar o futebol real e usá-lo como referência na carreira.
        </p>
      </section>

      <section aria-labelledby="modes" className="space-y-4">
        <h2 id="modes" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Os modos de jogo e o que cada um ensina
        </h2>
        <p>
          O jogo foi organizado em modos que se complementam. Cada um responde a um tipo de
          sessão: alguns minutos no ônibus, uma noite inteira planejando a temporada ou uma
          disputa com um amigo. A tabela mostra como eles se encaixam.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <caption className="sr-only">Modos de jogo, duração típica e foco</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Modo</th>
                <th scope="col" className="p-3">Sessão típica</th>
                <th scope="col" className="p-3">Foco</th>
                <th scope="col" className="p-3">Precisa de internet?</th>
              </tr>
            </thead>
            <tbody>
              {MODES.map((mode) => (
                <tr key={mode.name} className="border-t border-border/60 align-top">
                  <th scope="row" className="p-3 font-medium text-foreground">{mode.name}</th>
                  <td className="p-3">{mode.session}</td>
                  <td className="p-3">{mode.focus}</td>
                  <td className="p-3">{mode.online}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A partida rápida é a porta de entrada: você escolhe dois clubes, a dificuldade e assiste
          ao jogo com narração e placar ao vivo. É o melhor jeito de entender como o 3D mostra a
          tática em ação antes de assumir uma carreira. A carreira de treinador é o coração do
          jogo, com mercado, elenco, treino, diretoria e temporadas que se encadeiam. A temporada
          automática existe para quem quer avançar rápido: o computador joga semana a semana, ou
          até o fim, e você interfere quando quiser. O multiplayer coloca dois treinadores frente a
          frente, com o placar conferido no servidor.
        </p>
      </section>

      <section aria-labelledby="devices" className="space-y-4">
        <h2 id="devices" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Pensado primeiro para o celular
        </h2>
        <p>
          A maior parte de quem joga usa celular, muitas vezes um modelo intermediário. Por isso
          o ponto de partida de cada tela é o aparelho mais simples, e não o computador mais
          rápido. A interface reorganiza menus e tabelas para telas pequenas, os botões têm área
          de toque confortável e a partida 3D escolhe sozinha a qualidade gráfica que o aparelho
          aguenta.
        </p>
        <p>
          Quando a aba vai para segundo plano, o desenho 3D pausa para economizar bateria. A
          simulação pesada roda separada da tela, então mesmo uma temporada inteira simulada não
          congela a interface. E, depois do primeiro carregamento, a carreira e as partidas
          funcionam sem internet — útil para quem joga no metrô ou com dados móveis limitados.
        </p>
        <p>
          A acessibilidade segue a mesma lógica. Há opções de leitura e contraste, respeito à
          preferência de reduzir movimento do sistema e controles que funcionam pelo teclado. As
          cenas de história podem ser pausadas, puladas ou desligadas por completo.
        </p>
      </section>

      <section aria-labelledby="values" className="space-y-4">
        <h2 id="values" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Compromissos com quem joga
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Sem vantagem escondida:</strong> itens visuais
            não mudam o resultado, e o placar do multiplayer é conferido no servidor.
          </li>
          <li>
            <strong className="text-foreground">Progresso respeitado:</strong> a nuvem não deixa um
            aparelho desatualizado apagar suas rodadas mais recentes.
          </li>
          <li>
            <strong className="text-foreground">Pagamento claro:</strong> o preço é confirmado
            antes de pagar, e os itens só são entregues depois da confirmação.
          </li>
          <li>
            <strong className="text-foreground">Dados cuidados:</strong> a política de privacidade
            explica o que é tratado e como pedir acesso ou exclusão.
          </li>
          <li>
            <strong className="text-foreground">Comunicação direta:</strong> as novidades ficam
            registradas aqui, e o criador responde pelos canais oficiais.
          </li>
        </ul>
      </section>

      <section aria-labelledby="timeline" className="space-y-4">
        <h2 id="timeline" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Linha do tempo das últimas atualizações
        </h2>
        <p>
          As {CHANGELOG.length} entregas mais recentes somam {updates} melhorias visíveis. A tabela
          resume o foco de cada uma; os detalhes completos aparecem logo abaixo, na seção de
          novidades.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Resumo das atualizações recentes</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Mês</th>
                <th scope="col" className="p-3">Atualização</th>
                <th scope="col" className="p-3">Melhorias</th>
              </tr>
            </thead>
            <tbody>
              {CHANGELOG.map((entry) => (
                <tr key={`${entry.date}-${entry.title}`} className="border-t border-border/60">
                  <td className="p-3 tabular-nums">{entry.date}</td>
                  <th scope="row" className="p-3 font-medium text-foreground">{entry.title}</th>
                  <td className="p-3 tabular-nums">{entry.items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="business" className="space-y-4">
        <h2 id="business" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Como o projeto se mantém
        </h2>
        <p>
          O jogo continua gratuito. A loja oferece {STORE_PACKS.length} itens opcionais — moedas,
          olheiros, treino, itens visuais e um passe mensal — que ajudam a manter servidores,
          dados esportivos e desenvolvimento. Nenhum item muda a simulação de forma escondida, e
          os itens visuais não alteram o resultado. A explicação completa, com custo por moeda e
          comparações, está na página de{" "}
          <Link to="/produtos" className="text-primary hover:underline">pacotes</Link>.
        </p>

      </section>

      <section aria-labelledby="match-inside" className="space-y-4">
        <h2 id="match-inside" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Bastidores: o que acontece numa partida
        </h2>
        <p>
          Quando o apito inicial soa, o motor de simulação começa a avançar a partida em pequenos
          passos. A cada passo, cada atleta decide para onde ir conforme a função tática, a posição
          da bola, os companheiros e os adversários. Quem está com a bola escolhe entre passar,
          driblar ou chutar, pesando o espaço livre e o risco de perder a posse. Atributos como
          passe, finalização, velocidade e físico mudam a chance de cada ação dar certo.
        </p>
        <p>
          Ao mesmo tempo, o desgaste avança. Correr muito, jogar no calor ou sob chuva consome mais
          energia, e um atleta cansado reage mais devagar e erra mais. Os corpos dos jogadores não
          se atravessam: contatos empurram os atletas, e as traves do gol são sólidas. É por isso
          que as substituições e os ajustes no intervalo fazem diferença de verdade.
        </p>
        <p>
          O 3D recebe esses resultados e cuida da apresentação: animações de corrida e chute,
          câmera de transmissão, iluminação do estádio, torcida e replays. Como a apresentação não
          decide nada, ela pode ficar mais leve num celular sem alterar o placar, e a mesma partida
          pode ser reassistida com o mesmo resultado.
        </p>
      </section>

      <section aria-labelledby="creator-faq" className="space-y-4">
        <h2 id="creator-faq" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Perguntas sobre o projeto
        </h2>
        <dl className="space-y-4">
          {CREATOR_FAQ.map((item) => (
            <div key={item.q} className="rounded-2xl border border-border/60 surface-card p-5">
              <dt className="font-display text-lg text-foreground">{item.q}</dt>
              <dd className="mt-2 text-sm">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="feedback" className="space-y-4">
        <h2 id="feedback" className="font-display text-2xl uppercase tracking-wide text-foreground">
          Como sua opinião vira atualização
        </h2>
        <p>
          Sugestões chegam pela comunidade no Discord, pelo e-mail do criador e pela página de
          contato. Os relatos mais úteis dizem o aparelho, o navegador, a página, o que você fez
          e o que aconteceu; para problemas de carreira, clube, temporada e rodada. Com essas
          informações é possível reproduzir o problema, corrigir a causa e conferir a correção
          antes de publicar.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>O relato é registrado e reproduzido em um ambiente de teste.</li>
          <li>A causa é corrigida e coberta por um teste automático quando possível.</li>
          <li>A versão passa pelas verificações de desempenho e estabilidade.</li>
          <li>A melhoria entra na linha do tempo de novidades desta página.</li>
        </ol>
        <p>
          Antes de enviar uma dúvida, vale consultar as {FAQ_COUNT}{" "}
          <Link to="/perguntas-frequentes" className="text-primary hover:underline">perguntas frequentes</Link>
          , que já respondem a maioria das questões sobre saves, partidas 3D e compras. Para
          aprender a jogar melhor, os{" "}
          <Link to="/guias" className="text-primary hover:underline">guias do treinador</Link> e o{" "}
          <Link to="/glossario-do-futebol" className="text-primary hover:underline">glossário</Link>{" "}
          são o melhor ponto de partida.
        </p>
      </section>
    </article>
  );
}
