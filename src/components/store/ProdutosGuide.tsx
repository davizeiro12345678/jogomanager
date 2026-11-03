/**
 * Guia editorial da página de pacotes. Os números das tabelas vêm do mesmo
 * catálogo e das mesmas regras de carteira usados pelo jogo, para que o texto
 * nunca divirja do que o jogador realmente recebe.
 */
import { Link } from "@tanstack/react-router";

import { formatPrice, PACK_BY_KEY, STORE_PACKS, type StorePack } from "@/game/store-catalog";
import { COIN_EXCHANGE, PREMIUM_SCOUT_REPORT_SIZE, SEASON_PASS_WEEKLY_COINS } from "@/lib/wallet-rules";

const COIN_PACK_KEYS = ["coins_starter", "coins_small", "coins_medium", "coins_large"] as const;

/** Bônus de itens de cada pacote de moedas, como descrito no catálogo. */
const COIN_PACK_BONUS: Record<(typeof COIN_PACK_KEYS)[number], { reports: number; boosts: number }> = {
  coins_starter: { reports: 1, boosts: 0 },
  coins_small: { reports: 2, boosts: 0 },
  coins_medium: { reports: 5, boosts: 2 },
  coins_large: { reports: 10, boosts: 5 },
};

const brl = (cents: number) => formatPrice(Math.round(cents), "brl");

function coinPackRows() {
  return COIN_PACK_KEYS.map((key) => {
    const pack = PACK_BY_KEY[key] as StorePack;
    const bonus = COIN_PACK_BONUS[key];
    const bonusCoins =
      bonus.reports * COIN_EXCHANGE.scout_report + bonus.boosts * COIN_EXCHANGE.training_boost;
    const totalValue = pack.coins + bonusCoins;
    return {
      pack,
      bonus,
      perReal: pack.coins / (pack.priceCents / 100),
      totalValue,
      valuePerReal: totalValue / (pack.priceCents / 100),
    };
  });
}

const PROFILES: { who: string; pick: string; why: string }[] = [
  {
    who: "Quer só experimentar a loja",
    pick: "Moedas iniciais",
    why: "O menor valor do catálogo já paga um relatório de olheiro e vem com outro de bônus, suficiente para descobrir uma joia na primeira janela.",
  },
  {
    who: "Joga uma temporada por semana",
    pick: "Baú de moedas",
    why: "Une moedas para o mercado e dois impulsos de treino. É a opção equilibrada para quem avança rodada a rodada e quer reforçar o elenco sem exagero.",
  },
  {
    who: "Mantém várias carreiras longas",
    pick: "Cofre de moedas ou Passe de temporada",
    why: "O Cofre tem o melhor custo por moeda em compra única; o Passe repõe moedas toda semana e libera relatórios ilimitados para quem joga sempre.",
  },
  {
    who: "Gosta de garimpar talentos",
    pick: "Pacote de olheiros",
    why: `Quinze relatórios premium, cada um mapeando ${PREMIUM_SCOUT_REPORT_SIZE} jovens de até 23 anos, transformam a base e o mercado de jovens no centro da estratégia.`,
  },
  {
    who: "Precisa acelerar a evolução do elenco",
    pick: "Pacote de treino",
    why: "Dez impulsos que se somam semana a semana encurtam o caminho de um jovem promissor até o time titular.",
  },
  {
    who: "Quer o estádio com a cara do clube",
    pick: "Pacote de estádio, de temas ou de comemorações",
    why: "Mudam só o visual: gramado, mosaicos, temas e comemorações em 3D. Não alteram o resultado das partidas.",
  },
];

export function ProdutosGuide() {
  const coinRows = coinPackRows();
  const boostsPerReport = COIN_EXCHANGE.training_boost / COIN_EXCHANGE.scout_report;
  const pass = PACK_BY_KEY["season_pass"];
  const monthlyPassCoins = SEASON_PASS_WEEKLY_COINS * 4;

  return (
    <article
      aria-labelledby="guide-title"
      className="mt-14 max-w-4xl space-y-12 text-[15px] leading-relaxed text-muted-foreground"
    >
      <header className="space-y-3">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Guia completo da loja
        </p>
        <h2 id="guide-title" className="font-display text-3xl uppercase text-foreground">
          Como escolher o pacote certo para a sua carreira
        </h2>
        <p>
          A loja do Pro Football Manager 3D é opcional. Todo o jogo — carreira, mercado, táticas,
          partidas em 3D e multiplayer — pode ser disputado sem gastar nada. Os pacotes servem para
          adiantar recursos que você também consegue ao longo das temporadas ou para mudar o
          visual do seu estádio. Este guia explica, com os números reais do catálogo, o que cada
          item entrega, quanto vale cada moeda e qual opção faz sentido para o seu estilo de jogo,
          para você decidir com calma e sem surpresa no pagamento.
        </p>
        <p>
          Os valores abaixo são calculados a partir do mesmo catálogo que abastece o checkout e
          das mesmas regras de troca que o servidor aplica. Se um preço mudar, as tabelas desta
          página mudam junto. O valor final continua sendo confirmado na tela de pagamento antes
          da compra.
        </p>
      </header>

      <section aria-labelledby="all-packs" className="space-y-4">
        <h3 id="all-packs" className="font-display text-2xl text-foreground">
          Os {STORE_PACKS.length} itens do catálogo lado a lado
        </h3>
        <p>
          O catálogo se divide em quatro famílias. Os pacotes de moedas abastecem a carteira usada
          no mercado e nas trocas. Os pacotes de olheiros e de treino entregam itens prontos, sem
          passar pela carteira. Os pacotes visuais mudam estádio, temas e comemorações. Por fim, o
          Passe de temporada é a única assinatura: ele se renova mês a mês e pode ser cancelado a
          qualquer momento.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Comparação de todos os pacotes da loja</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Item</th>
                <th scope="col" className="p-3">Tipo</th>
                <th scope="col" className="p-3">Preço</th>
                <th scope="col" className="p-3">Moedas</th>
                <th scope="col" className="p-3">O que vem dentro</th>
              </tr>
            </thead>
            <tbody>
              {STORE_PACKS.map((pack) => (
                <tr key={pack.key} className="border-t border-border/60 align-top">
                  <th scope="row" className="p-3 font-medium text-foreground">
                    {pack.name}
                  </th>
                  <td className="p-3">{pack.recurring ? "Assinatura mensal" : "Compra única"}</td>
                  <td className="p-3 tabular-nums">
                    {formatPrice(pack.priceCents, pack.currency)}
                    {pack.recurring ? "/mês" : ""}
                  </td>
                  <td className="p-3 tabular-nums">{pack.coins > 0 ? pack.coins.toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-3">{pack.contents.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="coin-value" className="space-y-4">
        <h3 id="coin-value" className="font-display text-2xl text-foreground">
          Quanto vale cada moeda
        </h3>
        <p>
          Dentro do jogo, as moedas viram itens por uma tabela fixa: um relatório de olheiro custa{" "}
          {COIN_EXCHANGE.scout_report} moedas e um impulso de treino custa{" "}
          {COIN_EXCHANGE.training_boost} moedas. Ou seja, um impulso equivale a{" "}
          {boostsPerReport.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} relatórios. Essas
          taxas são as mesmas aplicadas pelo servidor; a carteira não pode ser alterada pelo
          aparelho, o que protege o equilíbrio entre quem compra e quem joga de graça.
        </p>
        <p>
          Com essa tabela, dá para comparar os pacotes de moedas de forma justa. A coluna “valor
          total” soma as moedas recebidas com o valor, em moedas, dos relatórios e impulsos que
          vêm de bônus — exatamente o que você pagaria para trocá-los na loja do jogo.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Custo por moeda dos pacotes de moedas</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Pacote</th>
                <th scope="col" className="p-3">Preço</th>
                <th scope="col" className="p-3">Moedas</th>
                <th scope="col" className="p-3">Moedas por R$ 1</th>
                <th scope="col" className="p-3">Bônus</th>
                <th scope="col" className="p-3">Valor total em moedas</th>
                <th scope="col" className="p-3">Valor total por R$ 1</th>
              </tr>
            </thead>
            <tbody>
              {coinRows.map((row) => (
                <tr key={row.pack.key} className="border-t border-border/60">
                  <th scope="row" className="p-3 font-medium text-foreground">
                    {row.pack.name}
                  </th>
                  <td className="p-3 tabular-nums">{brl(row.pack.priceCents)}</td>
                  <td className="p-3 tabular-nums">{row.pack.coins.toLocaleString("pt-BR")}</td>
                  <td className="p-3 tabular-nums">{row.perReal.toFixed(1)}</td>
                  <td className="p-3">
                    {row.bonus.reports} relat.{row.bonus.boosts ? ` + ${row.bonus.boosts} impulsos` : ""}
                  </td>
                  <td className="p-3 tabular-nums">{row.totalValue.toLocaleString("pt-BR")}</td>
                  <td className="p-3 tabular-nums">{row.valuePerReal.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          A leitura é direta: cada degrau da escada de moedas entrega mais por real do que o
          anterior. O pacote inicial existe para quem quer testar com o menor gasto possível; o
          Cofre faz sentido para quem já sabe que vai jogar várias temporadas e quer resolver o
          mercado de uma vez. Entre os dois, o Baú costuma ser o ponto de equilíbrio, porque os
          dois impulsos de treino incluídos já representam uma parte relevante do valor.
        </p>
      </section>

      <section aria-labelledby="pass" className="space-y-4">
        <h3 id="pass" className="font-display text-2xl text-foreground">
          Passe de temporada ou compra única?
        </h3>
        <p>
          O Passe de temporada custa {pass ? formatPrice(pass.priceCents, pass.currency) : "o valor do catálogo"} por
          mês e credita {SEASON_PASS_WEEKLY_COINS} moedas a cada sete dias enquanto estiver ativo —
          cerca de {monthlyPassCoins.toLocaleString("pt-BR")} moedas em quatro semanas. Além das
          moedas, ele libera relatórios premium de olheiro sem limite e todos os itens visuais. O
          resgate das moedas semanais é feito dentro do jogo, e a assinatura pode ser cancelada
          quando você quiser, sem multa.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Comparação entre Passe de temporada e compras únicas</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Critério</th>
                <th scope="col" className="p-3">Passe de temporada</th>
                <th scope="col" className="p-3">Pacotes de compra única</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Cobrança", "Mensal, até cancelar", "Uma vez por compra"],
                ["Moedas", `${SEASON_PASS_WEEKLY_COINS} por semana`, "Todas creditadas na hora"],
                ["Relatórios de olheiro", "Premium ilimitados", "Quantidade fixa por pacote"],
                ["Itens visuais", "Todos liberados", "Só os do pacote comprado"],
                ["Melhor para", "Quem joga toda semana", "Quem joga em ritmo irregular"],
              ].map(([criterion, passValue, single]) => (
                <tr key={criterion} className="border-t border-border/60">
                  <th scope="row" className="p-3 font-medium text-foreground">{criterion}</th>
                  <td className="p-3">{passValue}</td>
                  <td className="p-3">{single}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Se você abre o jogo várias vezes por semana, o Passe tende a render mais, porque as
          moedas chegam continuamente e os relatórios ilimitados eliminam a escolha de “onde usar
          o próximo olheiro”. Se você joga em fases, com semanas paradas, um pacote de compra única
          é mais previsível: você paga uma vez e usa no seu ritmo, sem cobrança recorrente.
        </p>
      </section>

      <section aria-labelledby="profiles" className="space-y-4">
        <h3 id="profiles" className="font-display text-2xl text-foreground">
          Qual pacote combina com o seu jeito de jogar
        </h3>
        <p>
          Não existe pacote “melhor” em absoluto. A escolha depende de quanto tempo você passa no
          jogo, de quantas carreiras mantém ao mesmo tempo e de onde está o gargalo do seu clube:
          falta de dinheiro no mercado, elenco envelhecido ou jovens que demoram a evoluir.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Recomendação de pacote por perfil de jogador</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Seu perfil</th>
                <th scope="col" className="p-3">Pacote sugerido</th>
                <th scope="col" className="p-3">Por quê</th>
              </tr>
            </thead>
            <tbody>
              {PROFILES.map((row) => (
                <tr key={row.who} className="border-t border-border/60 align-top">
                  <th scope="row" className="p-3 font-medium text-foreground">{row.who}</th>
                  <td className="p-3">{row.pick}</td>
                  <td className="p-3">{row.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="scout-training" className="space-y-4">
        <h3 id="scout-training" className="font-display text-2xl text-foreground">
          Olheiros e treino: como os itens agem na carreira
        </h3>
        <p>
          Um relatório premium de olheiro revela informações que normalmente ficam escondidas:
          potencial e personalidade. Cada relatório mapeia {PREMIUM_SCOUT_REPORT_SIZE} jovens de
          até 23 anos, o que ajuda a encontrar atletas baratos com margem de crescimento antes que
          os rivais percebam. Na prática, isso muda a forma de montar o elenco: em vez de pagar
          caro por um titular pronto, você pode formar uma geração e vender parte dela com lucro
          mais tarde.
        </p>
        <p>
          O impulso de treino age na semana: +25% de evolução e +5 de recuperação. Os impulsos se
          somam, então usar vários em sequência mantém o ritmo de desenvolvimento alto por mais
          tempo. Eles são mais úteis em jovens com potencial alto e em atletas voltando de uma
          sequência pesada de jogos, quando a recuperação extra evita perda de rendimento.
        </p>
        <p>
          Os dois itens também podem ser obtidos trocando moedas, pela tabela fixa mostrada acima.
          Por isso, quem prefere não comprar pacotes específicos pode juntar moedas e decidir na
          hora se precisa mais de informação (olheiro) ou de evolução (treino).
        </p>
      </section>

      <section aria-labelledby="cosmetics" className="space-y-4">
        <h3 id="cosmetics" className="font-display text-2xl text-foreground">
          Itens visuais não mudam o resultado
        </h3>
        <p>
          Os pacotes de estádio, de temas e de comemorações alteram apenas a aparência: cortes de
          gramado, bandeirões e mosaicos da torcida, temas de interface e novas comemorações em 3D
          com câmera própria no replay do gol. Eles não mexem em atributos, tática nem simulação. A
          partida é decidida lance a lance por um motor determinístico, e o visual é só a forma de
          desenhar o que esse motor calcula.
        </p>
        <p>
          Isso é importante para a justiça do multiplayer: o placar final das partidas online é
          conferido pela reprodução da partida no servidor, e nenhum item da loja dá vantagem
          escondida em campo.
        </p>
      </section>

      <section aria-labelledby="mistakes" className="space-y-4">
        <h3 id="mistakes" className="font-display text-2xl text-foreground">
          Cinco erros comuns ao usar a loja
        </h3>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong className="text-foreground">Comprar moedas sem plano.</strong> Antes de
            comprar, defina o que falta no clube. Se o problema é informação sobre jovens, um
            pacote de olheiros resolve melhor do que moedas avulsas.
          </li>
          <li>
            <strong className="text-foreground">Usar impulsos em atletas veteranos.</strong> O
            ganho de evolução rende mais em jogadores jovens com potencial alto; em veteranos, a
            recuperação extra é o benefício principal.
          </li>
          <li>
            <strong className="text-foreground">Comprar com outra conta.</strong> Os itens vão para
            a conta usada na compra. Confira se você entrou na conta certa antes de pagar.
          </li>
          <li>
            <strong className="text-foreground">Repetir o pagamento por impaciência.</strong> A
            confirmação pode levar alguns instantes. Consulte o histórico de compras antes de
            tentar de novo.
          </li>
          <li>
            <strong className="text-foreground">Esperar vantagem de itens visuais.</strong>{" "}
            Gramado, temas e comemorações deixam o jogo com a cara do seu clube, mas não mudam a
            força do time.
          </li>
        </ol>
      </section>

      <section aria-labelledby="store-glossary" className="space-y-4">
        <h3 id="store-glossary" className="font-display text-2xl text-foreground">
          Glossário rápido da loja
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Termos usados na loja e seus significados</caption>
            <thead className="bg-secondary/40 text-foreground">
              <tr>
                <th scope="col" className="p-3">Termo</th>
                <th scope="col" className="p-3">O que significa</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Moedas", "Saldo da carteira usado para trocar por relatórios e impulsos dentro do jogo."],
                ["Relatório premium", `Revela potencial e personalidade de ${PREMIUM_SCOUT_REPORT_SIZE} jovens de até 23 anos.`],
                ["Impulso de treino", "+25% de evolução e +5 de recuperação na semana; vários se somam."],
                ["Bônus", "Itens extras incluídos no pacote, além do conteúdo principal."],
                ["Item visual", "Muda gramado, torcida, tema ou comemorações, sem efeito no resultado."],
                ["Resgate semanal", `Crédito de ${SEASON_PASS_WEEKLY_COINS} moedas a cada 7 dias enquanto o passe estiver ativo.`],
                ["Compra como visitante", "Compra feita só com e-mail, sem criar conta, vinculável depois."],
              ].map(([term, meaning]) => (
                <tr key={term} className="border-t border-border/60">
                  <th scope="row" className="p-3 font-medium text-foreground">{term}</th>
                  <td className="p-3">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="how-to-buy" className="space-y-4">
        <h3 id="how-to-buy" className="font-display text-2xl text-foreground">
          Passo a passo da compra
        </h3>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Escolha o pacote nesta página e leia a lista de conteúdo. Se quiser, abra o visual do
            pacote para ver a prévia em 3D.
          </li>
          <li>
            Se você já tem conta, entre antes de comprar: os itens chegam direto na sua carreira.
            Sem conta, use “Comprar como visitante” e informe um e-mail que você acessa.
          </li>
          <li>
            Confira o total na tela de pagamento segura da Stripe. O jogo não vê nem guarda os
            dados completos do seu cartão.
          </li>
          <li>
            Aguarde a confirmação. O servidor só entrega os itens depois que o pagamento é
            confirmado, então evite repetir a compra enquanto ela estiver em processamento.
          </li>
          <li>
            Consulte o pedido em{" "}
            <Link to="/compras" className="text-primary hover:underline">minhas compras</Link>{" "}
            e use os itens na{" "}
            <Link to="/loja" className="text-primary hover:underline">loja dentro do jogo</Link>.
          </li>
        </ol>
      </section>

      <section aria-labelledby="security" className="space-y-4">
        <h3 id="security" className="font-display text-2xl text-foreground">
          Segurança, entrega e suporte
        </h3>
        <p>
          Cada compra é validada no servidor pelo preço oficial do catálogo e pela confirmação
          assinada do provedor de pagamento. Esse cuidado impede itens entregues sem pagamento e
          também garante que um pagamento confirmado gere a entrega correta, mesmo se você fechar
          a página logo depois de pagar.
        </p>
        <p>
          Se o item não aparecer, verifique se está na mesma conta usada na compra e consulte o
          histórico. Persistindo o problema, procure a página de{" "}
          <Link to="/contato" className="text-primary hover:underline">contato e suporte</Link>{" "}
          informando o e-mail e a data do pedido. Nunca envie número de cartão, senha ou código de
          verificação por chat ou e-mail. As regras completas estão nos{" "}
          <Link to="/termos" className="text-primary hover:underline">termos de uso</Link> e na{" "}
          <Link to="/privacidade" className="text-primary hover:underline">política de privacidade</Link>.
        </p>
      </section>

      <section aria-labelledby="free-path" className="space-y-4">
        <h3 id="free-path" className="font-display text-2xl text-foreground">
          Dá para chegar longe sem comprar nada
        </h3>
        <p>
          Os pacotes encurtam caminhos, mas a carreira foi pensada para ser vencida com boas
          decisões. Um olheiro bem usado, uma folha salarial controlada e uma formação que
          aproveita o elenco valem mais do que qualquer bônus. Se você está começando, leia o{" "}
          <Link to="/guias" className="text-primary hover:underline">guia do treinador</Link>, as{" "}
          <Link to="/dicas-de-gestao" className="text-primary hover:underline">dicas de gestão financeira</Link>{" "}
          e as{" "}
          <Link to="/melhores-formacoes" className="text-primary hover:underline">melhores formações</Link>{" "}
          antes de decidir se algum pacote faz sentido para você. Dúvidas rápidas sobre moedas,
          passe e entrega estão nas{" "}
          <Link to="/perguntas-frequentes" className="text-primary hover:underline">perguntas frequentes</Link>.
        </p>
      </section>
    </article>
  );
}
