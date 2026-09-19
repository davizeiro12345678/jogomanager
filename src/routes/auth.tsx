import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Apple, CheckCircle2, Cloud, Gamepad2, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // Only same-origin relative paths; never full URLs.
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

type SocialProvider = "google" | "microsoft" | "apple" | "lovable";

const SOCIALS: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
  { id: "apple", label: "Apple" },
  { id: "lovable", label: "Lovable" },
];

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = safeNext(s["next"]);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Entrar · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Entrar · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const destination = next ?? "/club";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ href: destination });
    });
  }, [navigate, destination]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fn =
      mode === "in"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(destination)}`,
            },
          });
    const { data, error: err } = await fn;
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) navigate({ href: destination });
    else setConfirmationSent(true);
  }

  async function signInWith(provider: SocialProvider) {
    setBusy(true);
    setError(null);

    window.sessionStorage.setItem("manager3d.auth.next", destination);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(destination)}`,
    });
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    if (result.redirected) return;
    setBusy(false);
    navigate({ href: destination });
  }

  return (
    <main className="pitch-bg grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden border-r border-border/60 bg-secondary/40 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 font-display text-sm uppercase text-primary">
              <Gamepad2 size={18} /> Pro Football Manager 3D
            </Link>
            <h1 className="mt-14 max-w-md font-display text-5xl uppercase leading-none">
              Sua carreira não precisa ficar presa a um aparelho.
            </h1>
            <p className="mt-5 max-w-md text-muted-foreground">
              Entre uma vez e continue do mesmo ponto no celular ou computador.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3"><Cloud className="text-primary" /> Carreira sincronizada automaticamente</li>
            <li className="flex items-center gap-3"><ShieldCheck className="text-primary" /> Compras e progresso ligados à sua conta</li>
            <li className="flex items-center gap-3"><CheckCircle2 className="text-primary" /> Jogue offline e sincronize ao voltar</li>
          </ul>
        </section>

        <section className="p-6 sm:p-9">
          <Link to="/" className="font-display text-xs uppercase text-primary lg:hidden">← Manager 3D</Link>
          <p className="font-display text-xs uppercase text-primary">Nuvem do treinador</p>
          <h2 className="mt-2 font-display text-3xl uppercase">
            {mode === "in" ? "Entrar e continuar" : "Criar sua conta"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O Google é a forma mais rápida: um clique, sem senha nova.
          </p>

          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => signInWith("google")}
            className="mt-6 h-12 w-full text-base"
          >
            Continuar com Google
          </Button>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {SOCIALS.filter((social) => social.id !== "google").map((social) => (
              <Button
                key={social.id}
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => signInWith(social.id)}
                className="min-h-11 px-2 text-xs"
              >
                {social.id === "apple" ? <Apple /> : null}
                {social.label}
              </Button>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-2 text-[11px] uppercase text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou use e-mail <span className="h-px flex-1 bg-border" />
          </div>

          {confirmationSent ? (
            <div className="mt-5 rounded-lg border border-primary/35 bg-primary/10 p-4 text-sm">
              <p className="font-medium text-foreground">Confira sua caixa de entrada</p>
              <p className="mt-1 text-muted-foreground">Enviamos um link para confirmar seu e-mail e concluir o cadastro.</p>
            </div>
          ) : (

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label htmlFor="auth-email" className="sr-only">
            E-mail
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <label htmlFor="auth-password" className="sr-only">
            Senha
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            disabled={busy}
            className="w-full"
          >
            <Mail /> {busy ? "Aguarde…" : mode === "in" ? "Entrar com e-mail" : "Criar conta com e-mail"}
          </Button>
        </form>
          )}

        <Button
          type="button"
          variant="ghost"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-xs text-muted-foreground"
        >
          {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </Button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Ao continuar, você concorda com os <Link to="/termos" className="underline">Termos</Link> e a <Link to="/privacidade" className="underline">Privacidade</Link>.
        </p>
        </section>
      </div>
    </main>
  );
}
