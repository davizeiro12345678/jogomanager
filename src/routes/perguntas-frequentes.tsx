import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";
import { CommunityInvite } from "@/components/CommunityInvite";

const PATH = "/perguntas-frequentes";
const TITLE = "Perguntas frequentes | Pro Football Manager 3D";
const DESC =
  "Perguntas frequentes sobre o Pro Football Manager 3D: é grátis? Precisa instalar? Funciona no celular? Todas as respostas.";

export const Route = createFileRoute("/perguntas-frequentes")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Perguntas frequentes", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

const QA = [
  [
    "O jogo é grátis mesmo?",
    "Sim. Carreira, partidas, táticas e mercado são grátis. A loja vende moedas, relatórios de olheiro, bônus de treino e temas visuais — nada disso é obrigatório para jogar ou vencer.",
  ],
  [
    "Os clubes e jogadores são reais?",
    "Sim. São mais de 24 mil clubes, 200 mil jogadores e 1.900 ligas com dados reais de elencos, tabelas e estatísticas, atualizados periodicamente.",
  ],
  [
    "Funciona no celular?",
    "Funciona no navegador do celular, tablet e PC. Em aparelhos mais simples, o jogo reduz os efeitos gráficos automaticamente para manter a partida fluida.",
  ],
  [
    "Preciso criar conta?",
    "Não para começar. Sem conta, a carreira fica salva só neste navegador. Com conta (Google, Apple, Microsoft ou e-mail), o progresso vai para a nuvem e você continua em outro aparelho.",
  ],
  [
    "Posso jogar contra amigos?",
    "Sim, no modo multiplayer: crie uma sala, envie o código e joguem a partida ao mesmo tempo, com o resultado calculado pelo servidor.",
  ],
  [
    "As compras são seguras?",
    "O pagamento é processado pela Stripe; o jogo nunca vê os dados do seu cartão. O item comprado é entregue na sua conta assim que o pagamento é confirmado.",
  ],
  [
    "Como participo da comunidade?",
    "Use o convite do Discord disponível nesta página. Você pode trocar táticas, encontrar adversários e compartilhar sugestões sobre o jogo.",
  ],
  [
    "Esqueci minha senha. Como volto à conta?",
    "Abra a página de entrada, selecione Esqueci minha senha e informe seu e-mail. Se houver uma conta associada, você receberá as instruções; confira também o spam.",
  ],
  [
    "Posso limpar o navegador sem perder a carreira?",
    "Exporte uma cópia no editor e confirme que o save foi sincronizado antes de limpar os dados. Uma carreira de convidado depende dos dados locais desse navegador.",
  ],
  [
    "Como relatar um problema?",
    "Na página de contato, escolha o assunto. Informe aparelho, navegador, página e passos que levam à falha. Evite publicar e-mail, comprovantes ou dados da conta no Discord.",
  ],
  [
    "As sugestões entram automaticamente no jogo?",
    "Sugestões da comunidade precisam ser avaliadas. Personalizações feitas no editor pertencem ao seu jogo e não alteram a base dos outros jogadores.",
  ],
  ["Preciso instalar alguma coisa?", "Não. O jogo roda no navegador, em computador ou celular."],
  [
    "É gratuito?",
    "Você pode jogar gratuitamente. A loja oferece compras opcionais; confira a descrição e o preço de cada produto antes de comprar.",
  ],
  [
    "Preciso criar conta?",
    "Não. Jogando como convidado, a carreira fica salva no próprio aparelho. Criar conta é opcional e serve para salvar na nuvem e continuar em outro dispositivo.",
  ],
  [
    "Funciona no celular?",
    "Sim. Use o modo de qualidade mais leve para manter a partida em 3D fluida.",
  ],
  [
    "Posso pular as partidas?",
    "Pode. Você escolhe assistir aos 90 minutos em 3D ou simular o resultado na hora.",
  ],
  [
    "Quais campeonatos estão disponíveis?",
    "Mais de trinta ligas, incluindo Brasileirão Série A e B, Premier League, LaLiga, Serie A, Bundesliga, Ligue 1 e Liga Portugal.",
  ],
  [
    "Posso usar meus próprios clubes e jogadores?",
    "Pode. A página de cadastro permite criar clubes e jogadores com escudo, cores, posição, contrato e valor.",
  ],
  [
    "Dá para ser demitido?",
    "Dá. A diretoria define um objetivo de temporada e a pressão sobe com maus resultados; outros clubes também podem te procurar.",
  ],
];

function Page() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-14">
      <div className="mx-auto max-w-3xl">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-primary">Dúvidas</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
          Perguntas frequentes
        </h1>

        <dl className="mt-8 space-y-6">
          {QA.map(([q, a]) => (
            <div key={q}>
              <dt className="font-display text-xl">{q}</dt>
              <dd className="mt-1 text-muted-foreground">{a}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <Link
            to="/new"
            className="rounded-lg bg-primary px-6 py-3 font-display text-sm uppercase tracking-widest text-primary-foreground"
          >
            Começar a jogar
          </Link>
        </div>

        <CommunityInvite compact />
        <PublicLinks exclude={PATH} />
      </div>
    </div>
  );
}
