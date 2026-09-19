import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { CONTENT_UPDATED, SiteFooter } from "@/components/SiteFooter";
import { articleLd, breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/contato";
const TITLE = "Contato e suporte · Pro Football Manager 3D";
const DESC =
  "Fale com a equipe do Pro Football Manager 3D: suporte de compras, problemas de carreira, denúncias no chat, pedidos de privacidade e sugestões de clubes e ligas.";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH, type: "article" }),
    links: canonical(PATH),
    scripts: [
      articleLd({ headline: "Contato e suporte", description: DESC, path: PATH }),
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Contato", path: PATH },
      ]),
    ],
  }),
  component: ContatoPage,
});

const CHANNELS = [
  {
    title: "Problema com uma compra",
    body: "Se um pacote foi pago e o saldo não apareceu, abra a página de compras: cada pedido mostra o status e a entrega é refeita automaticamente quando você volta da tela de pagamento. Se continuar pendente por mais de uma hora, fale com a gente pelo chat com o número do pedido.",
    to: "/compras" as const,
    cta: "Ver minhas compras",
  },
  {
    title: "Carreira travada ou progresso perdido",
    body: "Antes de qualquer coisa, exporte a carreira pelo editor: isso gera uma cópia que podemos analisar. Em seguida descreva o que aconteceu, em qual rodada e em qual aparelho.",
    to: "/editor" as const,
    cta: "Abrir o editor",
  },
  {
    title: "Denúncia ou bloqueio no chat",
    body: "Toda mensagem tem a opção de denunciar e de bloquear o autor. As denúncias chegam diretamente para a moderação e são analisadas uma a uma; bloqueios valem na hora e escondem o técnico do seu chat.",
    to: "/chat" as const,
    cta: "Ir para o chat",
  },
  {
    title: "Privacidade e exclusão de conta",
    body: "Pedidos de acesso, correção, exportação ou exclusão de dados devem ser feitos pela conta cadastrada. A política explica quais dados existem e por quanto tempo ficam guardados.",
    to: "/privacidade" as const,
    cta: "Ler a política",
  },
  {
    title: "Sugerir clube, liga ou correção de elenco",
    body: "Faltou um clube da sua cidade ou um elenco está desatualizado? Você mesmo pode cadastrar clubes e jogadores, e as sugestões entram na fila de revisão da base oficial.",
    to: "/cadastro" as const,
    cta: "Cadastrar clube ou jogador",
  },
] as const;

function ContatoPage() {
  return (
    <div className="pitch-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-xs uppercase tracking-widest text-primary">
          ← Início
        </Link>
        <h1 className="mt-3 font-display text-3xl uppercase tracking-wide sm:text-4xl">
          Contato e suporte
        </h1>
        <p className="mt-3 text-muted-foreground">
          A equipe do Pro Football Manager 3D responde por estes canais. Escolha o assunto para
          chegar mais rápido a quem resolve. Página atualizada em{" "}
          <time dateTime={CONTENT_UPDATED}>14 de setembro de 2026</time>.
        </p>

        <section className="surface-card mt-6 rounded-xl border border-primary/30 p-5">
          <h2 className="font-display text-xl uppercase">Contato direto</h2>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a
              href="mailto:davizeiro10.jogos@gmail.com"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-primary hover:bg-primary/10"
            >
              davizeiro10.jogos@gmail.com
            </a>
            <a
              href="https://wa.me/5527997294771"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-primary hover:bg-primary/10"
            >
              WhatsApp: +55 27 99729-4771
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Nunca envie senha, código de acesso ou dados completos de cartão por e-mail ou WhatsApp.
          </p>
        </section>

        <div className="mt-8 space-y-4">
          {CHANNELS.map((c) => (
            <section key={c.title} className="surface-card rounded-xl border border-border/60 p-5">
              <h2 className="font-display text-lg uppercase tracking-wide">{c.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
              <Link
                to={c.to}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-primary/40 px-4 text-xs uppercase tracking-widest text-primary hover:bg-primary/10"
              >
                {c.cta}
              </Link>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Tempo médio de resposta: até dois dias úteis. Nunca pedimos senha, código de verificação
          ou dados de cartão — se alguém pedir em nome do jogo, é golpe.
        </p>

        <PublicLinks exclude={PATH} />
        <SiteFooter path={PATH} />
      </div>
    </div>
  );
}
