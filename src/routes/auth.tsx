import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // Only same-origin relative paths; never full URLs.
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const next = safeNext(s["next"]);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Acesse sua conta para salvar a carreira de técnico e continuar a temporada de onde parou.",
      },
      { property: "og:title", content: "Entrar · Pro Football Manager 3D" },
      { property: "og:description", content: "Sua carreira de técnico salva na nuvem." },
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
              emailRedirectTo: `${window.location.origin}${destination}`,
            },
          });
    const { data, error: err } = await fn;
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data.session) navigate({ href: destination });
    else setError("Confirme o e-mail enviado para concluir o cadastro.");
  }

  return (
    <div className="pitch-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/85 p-6 backdrop-blur-xl">
        <Link to="/" className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Manager 3D
        </Link>
        <h1 className="mt-2 font-display text-3xl">
          {mode === "in" ? "Entrar no vestiário" : "Criar conta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua carreira fica salva e acompanha você em qualquer dispositivo.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label htmlFor="auth-email" className="sr-only">E-mail</label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <label htmlFor="auth-password" className="sr-only">Senha</label>
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
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 font-display text-sm uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "..." : mode === "in" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "in" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
