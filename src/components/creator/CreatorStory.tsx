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
