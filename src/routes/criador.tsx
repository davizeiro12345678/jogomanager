import { createFileRoute, Link } from "@tanstack/react-router";

import { PublicLinks } from "@/components/PublicLinks";
import { DiscordLink } from "@/components/CommunityInvite";
import { CHANGELOG, CREATOR } from "@/content/changelog";
import { breadcrumbLd, canonical, seoMeta } from "@/lib/seo";

const PATH = "/criador";
const TITLE = "Criador do Pro Football Manager 3D | Novidades";
const DESC =
  "Conheça o criador do Pro Football Manager 3D, veja as atualizações do jogo e acompanhe o desenvolvimento do manager de futebol 3D no navegador.";

export const Route = createFileRoute("/criador")({
  head: () => ({
    meta: seoMeta({ title: TITLE, description: DESC, path: PATH }),
    links: canonical(PATH),
    scripts: [
      breadcrumbLd([
        { name: "Início", path: "/" },
        { name: "Criador", path: PATH },
      ]),
    ],
  }),
  component: Page,
});

function Page() {
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
                href="mailto:davizeiro10.jogos@gmail.com"
                className="break-all text-primary underline underline-offset-4"
              >
                davizeiro10.jogos@gmail.com
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium">E-mail secundário</dt>
            <dd>
              <a
                href="mailto:davithomazini779@gmail.com"
                className="break-all text-primary underline underline-offset-4"
              >
                davithomazini779@gmail.com
              </a>
            </dd>
          </div>
        </dl>
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
