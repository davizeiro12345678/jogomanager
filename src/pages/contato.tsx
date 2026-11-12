import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

import { PublicLinks } from "@/components/PublicLinks";

import { SiteFooter } from "@/components/SiteFooter";

import { DiscordLink } from "@/components/CommunityInvite";
import { CREATOR } from "@/content/creator";
import { CreatorDetails } from "@/components/creator/CreatorDetails";
import { CONTATO_PATH as PATH } from "@/lib/public-route-paths";
import { reportRoomFromSearch } from "@/lib/support-report-context";
import { useT } from "@/i18n/provider";
import { creatorMessages } from "@/i18n/creator-messages";
import { moderationReviewMessages } from "@/i18n/moderation-review-messages";

const CHANNELS = [
  {
    title: "Problema com uma compra",
    body: "Se um pacote foi pago e o benefício não apareceu, abra a página de compras e confira o estado do pedido. Se continuar pendente, entre em contato pelo e-mail principal com o número do pedido e a data aproximada. Não encaminhe dados de cartão.",
    to: "/compras" as const,
    cta: "Ver minhas compras",
  },
  {
    title: "Carreira travada ou progresso perdido",
    body: "Antes de alterar ou substituir a carreira, preserve as cópias locais e exporte o progresso quando a opção estiver disponível. Depois descreva clube, temporada, rodada, dispositivo e o estado de sincronização apresentado.",
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

const SupportTicketForm = lazy(() =>
  import("@/components/support/SupportTicketForm").then((module) => ({
    default: module.SupportTicketForm,
  })),
);

const ModerationReviewCenter = lazy(() =>
  import("@/components/support/ModerationReviewCenter").then((module) => ({
    default: module.ModerationReviewCenter,
  })),
);

export function ContatoPage() {
  const { lang } = useT();
  const copy = creatorMessages(lang);
  const moderationCopy = moderationReviewMessages(lang);
  // Render the same initial HTML on server and browser, then open contextually.
  const [supportOpen, setSupportOpen] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  useEffect(() => {
    if (reportRoomFromSearch(window.location.search) !== null) setSupportOpen(true);
  }, []);
  return (
    <div className="pitch-bg min-h-dvh px-4 py-10">
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
          <time dateTime="2026-11-08">{copy.updatedDate}</time>.
        </p>

        <section
          className="surface-card mt-6 rounded-2xl border border-primary/40 p-5 sm:p-6"
          aria-labelledby="support-ticket-title"
        >
          <p className="text-xs uppercase tracking-widest text-primary">{copy.supportEyebrow}</p>
          <h2 id="support-ticket-title" className="mt-2 font-display text-2xl">
            {copy.supportTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {copy.supportDescription}
          </p>
          {supportOpen ? (
            <Suspense
              fallback={
                <p role="status" className="mt-4 text-sm">
                  {copy.supportLoading}
                </p>
              }
            >
              <SupportTicketForm />
            </Suspense>
          ) : (
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="mt-4 min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              {copy.supportStart}
            </button>
          )}
        </section>

        <section
          className="surface-card mt-6 rounded-xl border border-border/60 p-5"
          aria-label={moderationCopy.sectionAria}
        >
          <h2 className="font-display text-xl">{moderationCopy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{moderationCopy.centerIntro}</p>
          {moderationOpen ? (
            <Suspense
              fallback={
                <p role="status" className="mt-4 text-sm text-muted-foreground">
                  {moderationCopy.loading}
                </p>
              }
            >
              <ModerationReviewCenter />
            </Suspense>
          ) : (
            <button
              type="button"
              onClick={() => setModerationOpen(true)}
              className="mt-4 min-h-11 rounded-lg border border-border px-4 text-sm"
            >
              {moderationCopy.open}
            </button>
          )}
        </section>

        <section className="surface-card mt-6 rounded-xl border border-primary/30 p-5">
          <h2 className="font-display text-xl uppercase">Contatos oficiais e comunidade</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para problemas com carreira, compras ou privacidade, dê preferência ao e-mail principal.
            Se não receber resposta ou tiver uma questão relacionada ao desenvolvimento, utilize o
            contato secundário. O Discord é um espaço comunitário, não um canal privado para dados
            de conta.
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a
              href="mailto:davizeiro10.jogos@gmail.com"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-primary hover:bg-primary/10"
            >
              E-mail principal: davizeiro10.jogos@gmail.com
            </a>
            <a
              href="mailto:davithomazini779@gmail.com"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-primary hover:bg-primary/10"
            >
              E-mail secundário: davithomazini779@gmail.com
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
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DiscordLink>Acessar servidor oficial do Discord</DiscordLink>
            <p className="text-xs text-muted-foreground">
              Comunidade para táticas, dúvidas gerais, novidades e sugestões. O convite oficial abre
              em outra aba.
            </p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Perfil do criador no Discord: {CREATOR.discordUsername} (nome visível:{" "}
            {CREATOR.discordDisplayName}). O perfil pessoal não substitui o suporte oficial.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Nunca envie senha, códigos de autenticação, dados completos de cartão ou comprovantes
            com informações pessoais por e-mail, WhatsApp ou Discord.
          </p>
        </section>

        <section className="surface-card mt-8 rounded-xl border border-border/60 p-5">
          <h2 className="font-display text-xl">Ajude a reproduzir o problema</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Informe a página, o aparelho e o navegador em que aconteceu.</li>
            <li>Descreva a ação, o resultado esperado e o que apareceu na tela.</li>
            <li>Para uma carreira, anote clube, temporada e rodada; guarde uma cópia exportada.</li>
            <li>
              Para compras, use o canal de atendimento e o número do pedido. Não publique
              comprovantes com dados pessoais no servidor.
            </li>
          </ol>
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
          O prazo de resposta depende do volume de solicitações. Nunca pedimos senha, código de
          verificação ou dados completos do cartão. Desconfie de qualquer solicitação desse tipo em
          nome do jogo.
        </p>

        <CreatorDetails />
        <PublicLinks exclude={PATH} />
        <SiteFooter path={PATH} />
      </div>
    </div>
  );
}
