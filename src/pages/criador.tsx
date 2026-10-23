import { Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";

import { DiscordLink } from "@/components/CommunityInvite";

import { CHANGELOG } from "@/content/changelog";
import { CREATOR } from "@/content/creator";
import { CRIADOR_PATH as PATH } from "@/lib/public-route-paths";

export function Page() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="font-display text-4xl uppercase tracking-wide">Sobre o criador</h1>
      <p className="mt-4 text-lg text-muted-foreground">{CREATOR.bio}</p>

      <section className="mt-8 rounded-2xl border border-border/60 surface-card p-5">
        <p className="font-display text-xl uppercase tracking-wide">{CREATOR.name}</p>
        <p className="text-sm text-muted-foreground">{CREATOR.role}</p>
        <p className="mt-3 text-sm">
          Canal no YouTube:{" "}
          <a
            href={CREATOR.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-foreground"
          >
            {CREATOR.youtubeLabel}
          </a>
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-border/60 surface-card p-5">
        <h2 className="font-display text-xl uppercase">Fale com o criador</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Para sugestões, dúvidas sobre desenvolvimento ou colaborações, utilize os canais oficiais.
          Pedidos sobre compras ou dados de conta devem ir para o suporte, sem divulgar informações
          privadas em canais públicos.
        </p>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="font-medium">E-mail principal</dt>
            <dd>
              <a
                href={`mailto:${CREATOR.primaryEmail}`}
                className="break-all text-primary underline underline-offset-4"
              >
                {CREATOR.primaryEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium">E-mail secundário</dt>
            <dd>
              <a
                href={`mailto:${CREATOR.secondaryEmail}`}
                className="break-all text-primary underline underline-offset-4"
              >
                {CREATOR.secondaryEmail}
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Perfil do criador no Discord</dt>
            <dd className="text-muted-foreground">
              Usuário: <strong className="text-foreground">{CREATOR.discordUsername}</strong>
              {" · "}Nome visível:{" "}
              <strong className="text-foreground">{CREATOR.discordDisplayName}</strong>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Este é o perfil pessoal do criador; para entrar na comunidade, use o convite oficial
          abaixo. Não compartilhe senhas nem códigos de autenticação.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <DiscordLink>Comunidade no Discord</DiscordLink>
          <Link to="/contato" className="text-sm text-primary underline underline-offset-4">
            Contato e suporte
          </Link>
        </div>
      </section>

      <h2 className="mt-12 font-display text-2xl uppercase tracking-wide">Novidades</h2>
      <ol className="mt-4 space-y-6">
        {CHANGELOG.map((entry) => (
          <li key={`${entry.date}-${entry.title}`} className="border-l-2 border-primary/50 pl-4">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">{entry.date}</p>
            <p className="font-display text-lg uppercase tracking-wide">{entry.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {entry.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-sm">
        <Link to="/" className="text-primary hover:underline">
          Voltar e começar uma carreira
        </Link>
      </p>

      <PublicLinks exclude={PATH} />
    </main>
  );
}
