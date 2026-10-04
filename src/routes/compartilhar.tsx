import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { canonical, seoMeta } from "@/lib/seo";
import { COPY_FIRST_DESTINATIONS, SHARE_MESSAGE, SHARE_URL, shareDestinations } from "@/lib/share";

const PATH = "/compartilhar";
const DESCRIPTION =
  "Compartilhe o Pro Football Manager 3D com seus amigos e convide novos treinadores para jogar grátis no navegador.";

export const Route = createFileRoute("/compartilhar")({
  head: () => ({
    meta: seoMeta({
      title: "Compartilhar Pro Football Manager 3D",
      description: DESCRIPTION,
      path: PATH,
    }),
    links: canonical(PATH),
  }),
  component: SharePage,
});

function SharePage() {
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(`${SHARE_MESSAGE}\n\n${SHARE_URL}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function nativeShare() {
    if (!navigator.share) return copyMessage();
    await navigator.share({
      title: "Pro Football Manager 3D",
      text: SHARE_MESSAGE,
      url: SHARE_URL,
    });
  }

  return (
    <main className="pitch-bg min-h-screen px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-xs uppercase text-primary">
          ← Voltar ao jogo
        </Link>
        <p className="mt-8 font-display text-xs uppercase text-primary">Convide um treinador</p>
        <h1 className="mt-2 font-display text-4xl uppercase sm:text-5xl">Compartilhe o jogo</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Envie uma mensagem pronta ou copie o texto para publicar onde quiser.
        </p>

        <section className="surface-card mt-8 rounded-xl border border-border/60 p-5">
          <h2 className="font-display text-xl uppercase">Mensagem pronta</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {SHARE_MESSAGE}\n\n{SHARE_URL}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={nativeShare}>
              <Share2 /> Compartilhar
            </Button>
            <Button variant="outline" onClick={copyMessage}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar mensagem"}
            </Button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl uppercase">Enviar diretamente</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shareDestinations().map((item) => (
              <Button key={item.id} asChild variant="outline" className="min-h-11 justify-start">
                <a href={item.href} target="_blank" rel="noopener noreferrer">
                  {item.label}
                </a>
              </Button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-2xl uppercase">Copiar e publicar</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Estas redes não aceitam texto preenchido automaticamente pelo navegador. Copie a
            mensagem e abra o destino.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {COPY_FIRST_DESTINATIONS.map((item) => (
              <Button
                key={item.id}
                variant="secondary"
                onClick={async () => {
                  await copyMessage();
                  window.open(item.href, "_blank", "noopener,noreferrer");
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
