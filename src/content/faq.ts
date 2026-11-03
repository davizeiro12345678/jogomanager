/**
 * Perguntas frequentes públicas. A mesma lista alimenta a página visível e a
 * marcação FAQPage, para que o texto indexado seja idêntico ao exibido.
 */
import { formatPrice, PACK_BY_KEY } from "@/game/store-catalog";
import { COIN_EXCHANGE, PREMIUM_SCOUT_REPORT_SIZE, SEASON_PASS_WEEKLY_COINS } from "@/lib/wallet-rules";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqGroup {
  id: string;
  title: string;
  intro: string;
  questions: FaqItem[];
}

const price = (key: string) => {
  const pack = PACK_BY_KEY[key];
  return pack ? formatPrice(pack.priceCents, pack.currency) : "o valor mostrado no catálogo";
};

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "comecar",
    title: "Começar a jogar",
    intro: "O básico para abrir o jogo pela primeira vez e entender o que dá para fazer.",
    questions: [
      {
        q: "O Pro Football Manager 3D é gratuito?",
        a: "Sim. Você começa a carreira, joga partidas rápidas e assiste aos jogos em 3D sem pagar. A loja oferece pacotes opcionais; nenhum deles é necessário para disputar uma temporada completa.",
      },
      {
        q: "Preciso instalar algo para jogar?",
        a: "Não. O jogo roda direto no navegador, no celular ou no computador. Basta abrir o site; não há download nem loja de aplicativos envolvida.",
      },
      {
        q: "Posso jogar sem criar uma conta?",
        a: "Pode. Como convidado, a carreira fica guardada no próprio navegador. Criar uma conta adiciona o salvamento na nuvem, para continuar em outro aparelho e proteger o progresso.",
      },
      {
        q: "Funciona em celulares e computadores?",
        a: "Funciona nos dois. A interface se reorganiza para telas pequenas e a qualidade gráfica do 3D é ajustada automaticamente conforme o aparelho, para manter a partida fluida.",
      },
      {
        q: "Qual modo devo experimentar primeiro?",
        a: "Comece por uma partida rápida para conhecer a visualização 3D em poucos minutos. Depois, abra uma carreira de treinador para administrar elenco, táticas, mercado e temporadas inteiras.",
      },
      {
        q: "Em quais idiomas o jogo está disponível?",
        a: "A interface tem 39 idiomas e detecta automaticamente o idioma do navegador. A narração ao vivo das partidas está disponível em português, inglês e espanhol.",
      },
      {
        q: "Quanto tempo dura uma temporada?",
        a: "Depende do seu ritmo. Você pode assistir a cada jogo, simular apenas o resultado ou usar o modo automático, que joga semana a semana ou até o fim da temporada por você.",
      },
      {
        q: "Como faço login?",
        a: "A tela de entrada aceita e-mail e senha e também contas Google, Apple e Microsoft, além de chave de acesso (passkey) nos navegadores compatíveis. Escolha o método que você usa com mais frequência.",
      },
    ],
  },
  {
    id: "carreira",
    title: "Carreira, clubes e competições",
    intro: "Como escolher o clube, montar o elenco e entender as competições.",
    questions: [
      {
        q: "Os clubes e jogadores são reais?",
        a: "A base reúne mais de 100 ligas e mais de 1.300 clubes com escudos, uniformes e cores próprias, a partir de dados esportivos reais. Alguns registros podem ter lacunas ou atraso de atualização.",
      },
      {
        q: "Por que a quantidade de clubes do catálogo difere da tela de carreira?",
        a: "O catálogo global inclui todos os registros importados, enquanto a carreira oferece os clubes com elenco e regras de competição completos. A tela de seleção mostra exatamente o que está disponível.",
      },
      {
        q: "Existe acesso e rebaixamento entre divisões?",
        a: "Sim. As ligas nacionais seguem uma pirâmide com acesso e rebaixamento resolvidos ao fim da temporada, mantendo o número de clubes de cada divisão.",
      },
      {
        q: "Como escolho minha primeira equipe?",
        a: "Compare o objetivo da diretoria, o orçamento e a profundidade do elenco por posição. Um clube intermediário costuma ensinar mais sobre gestão do que um favorito ao título.",
      },
      {
        q: "O que a diretoria espera de mim?",
        a: "Cada clube tem um objetivo de temporada, como evitar o rebaixamento, brigar por vaga continental ou conquistar o título. O desempenho em relação a essa meta pesa na sua avaliação.",
      },
      {
        q: "O que são overall e potencial?",
        a: "Overall resume o nível atual do atleta; potencial estima até onde ele pode chegar. Use os dois com cuidado: função tática, idade, salário e condição física também decidem se a contratação vale a pena.",
      },
      {
        q: "Como funcionam as estatísticas da carreira?",
        a: "O jogo guarda o histórico de cada partida, com gols, assistências e notas dos atletas. Assim você compara a fase de cada jogador ao longo da temporada, não só o resultado final.",
      },
      {
        q: "Posso trocar de clube no meio da carreira?",
        a: "A carreira acompanha o treinador. Consulte as propostas e opções exibidas no jogo para saber quando uma mudança está disponível na versão atual.",
      },
    ],
  },
  {
    id: "partida",
    title: "Partida 3D",
    intro: "O que você vê em campo e como deixar a partida mais fluida.",
    questions: [
      {
        q: "Dá para assistir à partida inteira em 3D?",
        a: "Sim. A partida é exibida em 3D com placar ao vivo e narração. Também é possível acelerar, pausar ou trocar de câmera durante o jogo.",
      },
      {
        q: "O resultado é decidido antes de o jogo começar?",
        a: "Não. A simulação acontece lance a lance e leva em conta atributos, tática, cansaço e clima. O 3D apenas desenha o que a simulação decide, então o que você vê é o que conta.",
      },
      {
        q: "Por que o mesmo jogo sempre dá o mesmo resultado no replay?",
        a: "A simulação é determinística: com os mesmos dados de entrada, ela produz o mesmo resultado. Isso garante replays fiéis e impede que o resultado mude só porque o aparelho é mais lento.",
      },
      {
        q: "Quais câmeras existem?",
        a: "Há uma câmera de transmissão de TV e outras visões selecionáveis no menu da partida. Os replays de gol usam enquadramentos próprios para destacar o lance.",
      },
      {
        q: "A partida está travando no meu celular. O que faço?",
        a: "Feche outras abas, mantenha o aparelho carregado e deixe a qualidade gráfica em automático. Se continuar, escolha uma qualidade menor nas opções gráficas; a simulação continua igual.",
      },
      {
        q: "O clima influencia o jogo?",
        a: "Sim. Calor e chuva aumentam o desgaste físico e a chuva deixa a movimentação mais pesada, o que muda o ritmo da partida e a importância das substituições.",
      },
      {
        q: "O que acontece se eu trocar de aba durante a partida?",
        a: "O desenho 3D pausa quando a aba fica em segundo plano para economizar bateria. Ao voltar, a partida continua de onde parou.",
      },
      {
        q: "O que são as cenas antes do jogo?",
        a: "São cenas curtas em 3D, como vestiário e túnel, que contam a história da sua carreira. Você pode pular, pausar ou desativar essas cenas a qualquer momento.",
      },
    ],
  },
  {
    id: "taticas",
    title: "Táticas e treino",
    intro: "Escalação, formação e evolução dos atletas.",
    questions: [
      {
        q: "Qual é a melhor formação?",
        a: "Não existe esquema que vence sempre. Escolha a formação conforme os jogadores que você tem e o adversário: pontas rápidos pedem amplitude, volantes fortes sustentam um meio mais compacto.",
      },
      {
        q: "Posso mudar a tática durante a partida?",
        a: "Sim. Ajustes no intervalo ou durante o jogo mudam a postura do time. Avalie o efeito ao longo de vários minutos antes de mudar de novo.",
      },
      {
        q: "Quando devo fazer substituições?",
        a: "Observe o cansaço, os cartões e o placar. Atletas exaustos perdem rendimento, e uma troca no momento certo pode virar uma partida apertada.",
      },
      {
        q: "Como o treino melhora o elenco?",
        a: "Os atletas evoluem semana a semana conforme idade, potencial e carga de treino. Jovens com bom potencial respondem mais rápido ao trabalho contínuo.",
      },
      {
        q: "O que é um impulso de treino?",
        a: "É um item que acelera a evolução da semana: +25% de evolução e +5 de recuperação. Os impulsos se somam semana a semana e podem vir de pacotes ou ser trocados por moedas.",
      },
      {
        q: "Como funciona o scouting?",
        a: `Os olheiros revelam informações escondidas dos atletas. Cada relatório premium mapeia ${PREMIUM_SCOUT_REPORT_SIZE} jovens de até 23 anos com potencial e personalidade revelados, ajudando a contratar antes dos rivais.`,
      },
      {
        q: "Como lido com lesões no elenco?",
        a: "Um atleta lesionado fica fora até se recuperar. Mantenha reservas para cada posição e dose a carga de treino para reduzir o desgaste do grupo.",
      },
      {
        q: "O cansaço muda o desempenho em campo?",
        a: "Sim. A energia cai durante o jogo conforme o esforço, o clima e o físico de cada atleta. Jogadores cansados correm menos e erram mais, por isso as trocas importam.",
      },
    ],
  },
  {
    id: "mercado",
    title: "Mercado de transferências",
    intro: "Contratar, vender e equilibrar o orçamento.",
    questions: [
      {
        q: "Como contrato um jogador?",
        a: "Encontre o atleta no mercado, confira valor, salário e função e faça a proposta. O clube vendedor e o próprio jogador precisam aceitar as condições.",
      },
      {
        q: "Vale a pena vender um titular?",
        a: "Às vezes. Uma boa venda libera orçamento para reforçar posições mais fracas. Antes, confirme que o elenco tem um substituto à altura para não perder rendimento.",
      },
      {
        q: "Como evito problemas financeiros no clube?",
        a: "Mantenha a folha salarial dentro do orçamento, priorize contratos que cabem na receita e evite comprar só pelo overall. O guia de gestão do site detalha estratégias.",
      },
      {
        q: "Jovens da base valem a pena?",
        a: "Jovens com potencial alto custam pouco e podem virar titulares ou vendas lucrativas. Combine minutos em jogo e treino para que eles se desenvolvam.",
      },
      {
        q: "Quando abre a janela de transferências?",
        a: "O mercado segue o calendário da temporada exibido na carreira. Fora da janela, você ainda pode observar atletas e preparar as propostas para quando ela abrir.",
      },
      {
        q: "Como sei se um jogador combina com meu time?",
        a: "Compare a posição, o pé preferido, a idade e os atributos que importam para a sua tática. Um relatório de olheiro revela potencial e personalidade antes de você investir.",
      },
    ],
  },
  {
    id: "salvamento",
    title: "Salvamento, nuvem e modo offline",
    intro: "Como seu progresso é guardado e como protegê-lo.",
    questions: [
      {
        q: "Como minha carreira é salva?",
        a: "Como convidado, o progresso fica no navegador. Com uma conta, a carreira também é enviada à nuvem quando há conexão. Confira o estado da sincronização antes de fechar o jogo.",
      },
      {
        q: "Posso continuar no computador depois de jogar no celular?",
        a: "Sim, entrando com a mesma conta nos dois aparelhos. Aguarde a sincronização terminar no primeiro aparelho antes de abrir a carreira no segundo.",
      },
      {
        q: "Um aparelho antigo pode apagar meu progresso mais recente?",
        a: "Não. A nuvem recusa um save com menos progresso do que o já guardado para a mesma carreira, então um aparelho desatualizado não sobrescreve as rodadas mais recentes.",
      },
      {
        q: "Posso jogar offline?",
        a: "Depois do primeiro carregamento, a carreira e as partidas funcionam sem internet. Login, nuvem, multiplayer, compras e atualizações precisam de conexão.",
      },
      {
        q: "Posso apagar os dados do navegador sem perder minha carreira?",
        a: "Só se a carreira estiver salva na nuvem. Uma carreira de convidado fica no navegador e é perdida ao limpar os dados. Entre numa conta antes de limpar.",
      },
      {
        q: "Comecei de novo com o mesmo clube e o progresso antigo voltou. É normal?",
        a: "Ao confirmar a substituição de uma carreira existente, o jogo limpa a anterior antes de criar a nova. Se o progresso antigo reaparecer, anote clube, temporada e aparelho e fale com o suporte.",
      },
      {
        q: "As conquistas podem ser perdidas?",
        a: "Conquistas permanentes são validadas pelo servidor a partir de progresso verificável, e não pelo save enviado pelo aparelho. Isso protege as conquistas legítimas contra trapaças.",
      },
    ],
  },
  {
    id: "loja",
    title: "Loja, moedas e pacotes",
    intro: "O que cada item faz e como a compra funciona.",
    questions: [
      {
        q: "A loja é obrigatória para disputar partidas?",
        a: "Não. Todo o jogo pode ser disputado de graça. Os pacotes adiantam recursos, como moedas, relatórios e impulsos de treino, ou mudam o visual do estádio e das comemorações.",
      },
      {
        q: "Para que servem as moedas?",
        a: `As moedas são trocadas por itens dentro do jogo: um relatório de olheiro custa ${COIN_EXCHANGE.scout_report} moedas e um impulso de treino custa ${COIN_EXCHANGE.training_boost} moedas.`,
      },
      {
        q: "Qual pacote de moedas rende mais?",
        a: `Quanto maior o pacote, mais moedas por real. O Cofre de moedas (${price("coins_large")}) tem o melhor custo por moeda e ainda inclui relatórios, impulsos e o tema dourado.`,
      },
      {
        q: "Como funciona o Passe de temporada?",
        a: `É uma assinatura mensal de ${price("season_pass")} que credita ${SEASON_PASS_WEEKLY_COINS} moedas a cada 7 dias, libera relatórios premium ilimitados e todos os cosméticos. Você pode cancelar quando quiser.`,
      },
      {
        q: "Posso comprar sem criar conta?",
        a: "Sim. A página de pacotes permite comprar como visitante informando um e-mail. Use um endereço ao qual você tenha acesso, para receber a confirmação e vincular os itens depois.",
      },
      {
        q: "O pagamento é seguro?",
        a: "O pagamento é processado pela Stripe em uma tela segura. O jogo nunca vê nem guarda os dados completos do seu cartão, e o servidor só entrega os itens depois que o pagamento é confirmado.",
      },
      {
        q: "Paguei, mas não recebi o produto. O que faço?",
        a: "Confira o histórico em Minhas compras e se você está na mesma conta usada na compra. Se o item não aparecer, fale com o suporte informando o e-mail e a data do pedido; nunca envie dados do cartão.",
      },
      {
        q: "Os preços podem mudar?",
        a: "Sim. Ofertas e valores podem mudar. O preço final é sempre confirmado na tela de pagamento antes de você concluir a compra.",
      },
    ],
  },
  {
    id: "suporte",
    title: "Multiplayer, suporte e privacidade",
    intro: "Jogar com amigos, pedir ajuda e cuidar dos seus dados.",
    questions: [
      {
        q: "Como funciona o multiplayer?",
        a: "Você cria uma sala e compartilha o convite com outro jogador. O placar final é decidido pela reprodução da partida no servidor, o que impede resultados inventados.",
      },
      {
        q: "Preciso de internet para enfrentar amigos?",
        a: "Sim. O multiplayer depende da conexão com os servidores do jogo durante toda a sessão.",
      },
      {
        q: "Onde encontro outros treinadores?",
        a: "Na comunidade oficial do Discord, pelo convite do site. Nunca compartilhe senhas, códigos de verificação ou dados de pagamento em chats.",
      },
      {
        q: "Como peço suporte ou faço uma sugestão?",
        a: "Use a página de contato. Informe o aparelho, o navegador, a página, o que você fez e o que aconteceu. Para problemas de carreira, inclua clube, temporada e rodada.",
      },
      {
        q: "Posso pedir acesso ou exclusão dos meus dados?",
        a: "Sim. A política de privacidade explica quais dados são tratados e como fazer pedidos de acesso, correção ou exclusão.",
      },
      {
        q: "Como acompanho as novidades do jogo?",
        a: "A página do criador reúne o histórico de atualizações, e o canal do criador no YouTube mostra as novidades em vídeo.",
      },
      {
        q: "Quem desenvolve o jogo?",
        a: "O Pro Football Manager 3D é criado por Davi Andrian Thomazini, um desenvolvedor independente apaixonado por futebol e por jogos de gestão.",
      },
    ],
  },
];

export const FAQ_COUNT = FAQ_GROUPS.reduce((total, group) => total + group.questions.length, 0);

/** Normaliza para busca sem acento e sem diferença de maiúsculas. */
export function normalizeFaqText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function searchFaq(query: string): FaqGroup[] {
  const terms = normalizeFaqText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return FAQ_GROUPS;
  return FAQ_GROUPS.map((group) => ({
    ...group,
    questions: group.questions.filter((item) => {
      const haystack = normalizeFaqText(`${item.q} ${item.a}`);
      return terms.every((term) => haystack.includes(term));
    }),
  })).filter((group) => group.questions.length > 0);
}

export function faqPageLd() {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_GROUPS.flatMap((group) =>
        group.questions.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      ),
    }),
  };
}
