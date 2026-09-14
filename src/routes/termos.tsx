import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { CONTENT_UPDATED, SiteFooter } from "@/components/SiteFooter";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/termos";
const TITLE = "Termos de uso · Pro Football Manager 3D";
const DESC =
  "Regras de uso do Pro Football Manager 3D: conta, conduta no chat, compras na loja, reembolso, conteúdo criado por você e limites de responsabilidade.";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Termos de uso", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Termos", path: PATH },
      ]),
    ],
  }),
  component: TermosPage,
});

const BLOCKS: { title: string; body: string }[] = [
  {
    title: "O serviço",
    body: "O Pro Football Manager 3D é um jogo de gestão de futebol executado no navegador, oferecido gratuitamente. Podemos mudar, acrescentar ou remover recursos a qualquer momento para melhorar o jogo, avisando quando a mudança afetar carreiras salvas.",
  },
  {
    title: "Conta e acesso",
    body: "Jogar não exige conta. Ao criar uma, você é responsável por manter o acesso ao e-mail cadastrado e por tudo que acontecer na conta. Contas usadas para fraude, burla de pagamento ou ataque ao serviço podem ser encerradas.",
  },
  {
    title: "Conduta no chat",
    body: "O chat é público. São proibidos discurso de ódio, assédio, conteúdo sexual, divulgação de dados pessoais de terceiros, spam e propaganda. Mensagens podem ser removidas e contas podem ser silenciadas ou encerradas em caso de reincidência. Denúncias são analisadas manualmente.",
  },
  {
    title: "Compras na loja",
    body: "Moedas, relatórios de olheiro, impulsos de treino, cosméticos e o passe de temporada são itens de conveniência, vinculados à sua conta e sem valor fora do jogo. Nenhuma compra é necessária para completar a carreira e nenhuma delas altera o resultado das partidas em favor de quem pagou.",
  },
  {
    title: "Pagamento e reembolso",
    body: "Os pagamentos são processados pela Stripe. Compras de itens entregues na hora podem ser canceladas em até sete dias, conforme o Código de Defesa do Consumidor, desde que os itens ainda não tenham sido consumidos. O passe de temporada é uma assinatura mensal e pode ser cancelado a qualquer momento, seguindo válido até o fim do período pago.",
  },
  {
    title: "Conteúdo criado por você",
    body: "Clubes, escudos, uniformes e elencos criados no editor continuam seus. Ao publicá-los no jogo, você nos autoriza a exibi-los para outros jogadores. Não envie conteúdo protegido por direitos de terceiros nem imagens ofensivas.",
  },
  {
    title: "Nomes reais",
    body: "Clubes, competições e jogadores reais aparecem como referência esportiva pública, a partir de bases abertas. O jogo não é licenciado nem patrocinado por clubes, ligas ou federações.",
  },
  {
    title: "Limites",
    body: "O jogo é oferecido como está. Fazemos o possível para manter tudo no ar e as carreiras salvas, mas não garantimos disponibilidade ininterrupta. Mantenha uma cópia local das carreiras que você não quer perder — o próprio jogo permite exportar.",
  },
];

function TermosPage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-xs uppercase tracking-widest text-primary">
          ← Início
        </Link>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-wide sm:text-4xl">
          Termos de uso
        </h1>
        <p className="mt-3 text-muted-foreground">
          Regras claras para jogar, conversar e comprar no Pro Football Manager 3D. Atualizados em{" "}
          <time dateTime={CONTENT_UPDATED}>14 de setembro de 2026</time>.
        </p>

        <div className="mt-8 space-y-6">
          {BLOCKS.map((b) => (
            <section key={b.title} className="surface-card rounded-xl border border-border/60 p-5">
              <h2 className="font-display text-lg uppercase tracking-wide">{b.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{b.body}</p>
            </section>
          ))}
        </div>

        <PublicLinks exclude={PATH} />
        <SiteFooter path={PATH} />
      </div>
    </div>
  );
}
