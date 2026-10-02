import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { CheckCircle2, Cloud, Eye, EyeOff, Gamepad2, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DiscordLink } from "@/components/CommunityInvite";
import { supabase } from "@/integrations/supabase/client";
import {
  availableSocialProviders,
  SOCIAL_LABELS,
  type SocialProvider,
} from "@/integrations/supabase/social-auth";
import { authErrorMessage, safeAuthNext, type AuthMode } from "@/lib/auth-policy";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    s: Record<string, unknown>,
  ): { next?: string; mode?: "up"; recovery?: boolean } => {
    const next = safeAuthNext(s["next"]);
    return {
      ...(next ? { next } : {}),
      ...(s["mode"] === "up" ? { mode: "up" as const } : {}),
      ...(s["recovery"] === "1" || s["recovery"] === true ? { recovery: true } : {}),
    };
  },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Entrar ou criar conta · Pro Football Manager 3D" },
      {
        name: "description",
        content:
          "Crie sua conta, entre no jogo e recupere sua senha para continuar a carreira no Pro Football Manager 3D.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const destination = search.next ?? "/club";
  const [mode, setMode] = useState<AuthMode>(search.mode === "up" ? "up" : "in");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [socials, setSocials] = useState<SocialProvider[]>([]);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const brokeredOAuth = import.meta.env["VITE_AUTH_MODE"] === "lovable";

  useEffect(() => {
    let alive = true;
    const recovery =
      search.recovery ||
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const authError =
      new URLSearchParams(window.location.hash.slice(1)).get("error_description") ||
      new URLSearchParams(window.location.search).get("error_description");
    if (authError)
      setError(
        "O link de acesso expirou ou não pôde ser validado. Solicite um novo link ou entre com e-mail.",
      );
    if (recovery) setMode("update");
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
        setRecoveryReady(Boolean(session));
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!alive) return;
        if (sessionError) {
          setError(
            "O link não pôde ser validado. Tente entrar novamente ou solicite outro e-mail.",
          );
          return;
        }
        if (recovery) {
          setRecoveryReady(Boolean(data.session));
          if (!data.session)
            setError("Abra o link de recuperação recebido por e-mail para definir uma nova senha.");
        } else if (data.session) {
          // Create missing profiles; preserve names and avatars customized by players.
          void supabase
            .from("profiles")
            .upsert(
              {
                user_id: data.session.user.id,
                display_name:
                  data.session.user.user_metadata["display_name"] ??
                  data.session.user.user_metadata["full_name"] ??
                  null,
              },
              { onConflict: "user_id", ignoreDuplicates: true },
            )
            .then(
              () => undefined,
              () => undefined,
            );
          void navigate({ href: destination });
        }
      })
      .catch(() => {
        if (alive)
          setError("Não foi possível verificar sua sessão. Confira a conexão e tente novamente.");
      });
    void availableSocialProviders()
      .then((providers) => {
        if (alive) setSocials(brokeredOAuth ? ["google", "azure", "apple"] : providers);
      })
      .catch(() => {
        if (alive && brokeredOAuth) setSocials(["google", "azure", "apple"]);
      });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [destination, navigate, search.recovery, brokeredOAuth]);

  const callback = (recovery = false) =>
    `${window.location.origin}/auth?next=${encodeURIComponent(destination)}${recovery ? "&recovery=1" : ""}`;
  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setConfirmationSent(false);
    setPassword("");
    setConfirmPassword("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    if ((mode === "up" || mode === "update") && password !== confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "reset") {
        const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: callback(true),
        });
        if (result.error) throw result.error;
        setNotice(
          "Se houver uma conta com esse e-mail, você receberá as instruções de recuperação. Confira também o spam.",
        );
      } else if (mode === "update") {
        if (!recoveryReady) throw new Error("No recovery session");
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        setNotice("Senha atualizada. Você já pode continuar sua carreira.");
        setPassword("");
        setConfirmPassword("");
      } else {
        const result =
          mode === "in"
            ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
            : await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: { emailRedirectTo: callback(), data: { display_name: name.trim() } },
              });
        if (result.error) throw result.error;
        if (result.data.session) await navigate({ href: destination });
        else {
          setConfirmationSent(true);
          setNotice(
            "Confira sua caixa de entrada para concluir o cadastro. Se já tiver uma conta, entre ou recupere sua senha.",
          );
        }
      }
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(provider: SocialProvider) {
    setBusy(true);
    setError(null);
    try {
      if (brokeredOAuth) {
        const { lovable } = await import("@/integrations/lovable/index");
        const result = await lovable.auth.signInWithOAuth(
          provider === "azure" ? "microsoft" : provider,
          { redirect_uri: callback() },
        );
        if (result.error) throw result.error;
        if (!result.redirected) await navigate({ href: destination });
      } else {
        const result = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: callback(), ...(provider === "azure" ? { scopes: "email" } : {}) },
        });
        if (result.error) throw result.error;
      }
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: callback() },
      });
      if (result.error) throw result.error;
      setNotice(
        "Se o cadastro estiver pendente, um novo link será enviado. Confira também o spam.",
      );
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }

  const title = {
    in: "Entrar e continuar",
    up: "Criar sua conta",
    reset: "Recuperar sua senha",
    update: "Definir nova senha",
  }[mode];
  const inputClass =
    "min-h-11 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <main className="pitch-bg grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden border-r border-border/60 bg-secondary/40 p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-display text-sm uppercase text-primary"
            >
              <Gamepad2 size={18} /> Pro Football Manager 3D
            </Link>
            <h2 className="mt-14 font-display text-5xl leading-none">
              Seu clube tem história. Sua conta ajuda a guardá-la.
            </h2>
            <p className="mt-5 text-muted-foreground">
              Jogue como convidado ou entre para usar os recursos online. Mantenha uma cópia
              exportada da sua carreira.
            </p>
          </div>
          <ul className="mt-10 space-y-4 text-sm">
            <li className="flex items-center gap-3">
              <Cloud className="shrink-0 text-primary" /> Salve sua carreira na nuvem quando estiver
              conectado
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="shrink-0 text-primary" /> Acesse as compras vinculadas à sua
              conta
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="shrink-0 text-primary" /> Continue com a mesma conta em outro
              aparelho
            </li>
          </ul>
          <div className="mt-8">
            <DiscordLink>Conhecer a comunidade</DiscordLink>
          </div>
        </section>
        <section className="p-6 sm:p-9">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center font-display text-xs uppercase text-primary"
          >
            ← Voltar ao jogo
          </Link>
          <p className="mt-4 font-display text-xs uppercase text-primary">Nuvem do treinador</p>
          <h1 className="mt-2 font-display text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "reset"
              ? "Enviaremos um link para o e-mail da sua conta."
              : mode === "update"
                ? "Escolha uma senha com pelo menos 8 caracteres."
                : "Use seu e-mail para entrar ou criar uma conta gratuita."}
          </p>
          {(mode === "in" || mode === "up") && socials.length > 0 && (
            <div className="mt-5 space-y-2">
              {socials.map((provider) => (
                <Button
                  key={provider}
                  type="button"
                  variant={provider === "google" ? "default" : "outline"}
                  disabled={busy}
                  className="min-h-11 w-full"
                  onClick={() => signInWith(provider)}
                >
                  Continuar com {SOCIAL_LABELS[provider]}
                </Button>
              ))}
              <p className="pt-2 text-center text-xs text-muted-foreground">
                ou continue com e-mail
              </p>
            </div>
          )}
          {notice && (
            <p
              role="status"
              aria-live="polite"
              className="mt-5 rounded-lg border border-primary/35 bg-primary/10 p-4 text-sm"
            >
              {notice}
            </p>
          )}
          {error && (
            <p id="auth-error" role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {confirmationSent ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={resend}
              className="mt-4 min-h-11 w-full"
            >
              {busy ? "Aguarde…" : "Reenviar confirmação"}
            </Button>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4" aria-busy={busy}>
              {mode === "up" && (
                <div>
                  <label htmlFor="auth-name" className="text-sm">
                    Nome do treinador
                  </label>
                  <input
                    id="auth-name"
                    required
                    minLength={2}
                    maxLength={60}
                    autoComplete="nickname"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                </div>
              )}
              {mode !== "update" && (
                <div>
                  <label htmlFor="auth-email" className="text-sm">
                    E-mail
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby={error ? "auth-error" : undefined}
                    className={`${inputClass} mt-1`}
                  />
                </div>
              )}
              {mode !== "reset" && (
                <div>
                  <label htmlFor="auth-password" className="text-sm">
                    {mode === "update" ? "Nova senha" : "Senha"}
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={mode === "in" ? 1 : 8}
                      maxLength={128}
                      autoComplete={mode === "in" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      aria-describedby={error ? "auth-error" : "password-hint"}
                      className={`${inputClass} pr-12`}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p id="password-hint" className="mt-1 text-xs text-muted-foreground">
                    {mode === "in"
                      ? "Use a senha da sua conta."
                      : "Use pelo menos 8 caracteres e evite senhas usadas em outros sites."}
                  </p>
                </div>
              )}
              {(mode === "up" || mode === "update") && (
                <div>
                  <label htmlFor="auth-confirm-password" className="text-sm">
                    Confirmar senha
                  </label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className={`${inputClass} mt-1`}
                  />
                </div>
              )}
              <Button
                type="submit"
                disabled={busy || (mode === "update" && !recoveryReady)}
                className="min-h-11 w-full"
              >
                <Mail size={18} />
                {busy
                  ? "Aguarde…"
                  : {
                      in: "Entrar com e-mail",
                      up: "Criar conta com e-mail",
                      reset: "Enviar link de recuperação",
                      update: "Salvar nova senha",
                    }[mode]}
              </Button>
            </form>
          )}
          {mode === "in" && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="mt-2 min-h-11 w-full text-sm"
              onClick={() => switchMode("reset")}
            >
              Esqueci minha senha
            </Button>
          )}
          {mode === "update" && notice ? (
            <Button asChild className="mt-4 w-full">
              <Link to={destination}>Continuar minha carreira</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              className="mt-3 min-h-11 w-full text-sm"
              onClick={() => switchMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "Não tem conta? Cadastre-se" : "Voltar para entrar"}
            </Button>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Ao criar uma conta, você concorda com os{" "}
            <Link to="/termos" className="underline">
              Termos de uso
            </Link>{" "}
            e a{" "}
            <Link to="/privacidade" className="underline">
              Política de privacidade
            </Link>
            .
          </p>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Você também pode{" "}
            <Link to="/new" className="text-primary underline">
              começar uma carreira como convidado
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
