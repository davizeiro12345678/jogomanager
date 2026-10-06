import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Cloud,
  Eye,
  EyeOff,
  Fingerprint,
  Gamepad2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DiscordLink } from "@/components/CommunityInvite";
import { supabase } from "@/integrations/supabase/client";
import {
  lovableOAuthProvider,
  socialOAuthOptions,
  socialProviderLabel,
  type SocialProvider,
} from "@/integrations/supabase/social-auth";
import {
  authCallbackErrorMessage,
  authErrorMessage,
  safeAuthNext,
  type AuthMode,
} from "@/lib/auth-policy";
import { useAuthMethods } from "@/hooks/useAuthMethods";
import { passkeyErrorMessage, supportsPasskeys } from "@/integrations/supabase/passkey-auth";
import authHero from "@/assets/hero-stadium.jpg?format=webp&w=1024&quality=60&as=url";
import "@/components/auth-store.css";

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
  const {
    methods,
    loading: methodsLoading,
    error: methodsError,
    retry: retryMethods,
  } = useAuthMethods();
  const [emailOtp, setEmailOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const brokeredOAuth = import.meta.env["VITE_AUTH_MODE"] === "lovable";
  const passkeysSupported = supportsPasskeys();

  useEffect(() => {
    let alive = true;
    const recovery =
      search.recovery ||
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    const authErrorCode = hashParams.get("error_code") || searchParams.get("error_code");
    const authErrorDescription =
      hashParams.get("error_description") || searchParams.get("error_description");
    const authError = hashParams.get("error") || searchParams.get("error");
    if (authError || authErrorCode || authErrorDescription)
      setError(authCallbackErrorMessage(authErrorCode, authErrorDescription));
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
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [destination, navigate, search.recovery]);

  const callback = (recovery = false) =>
    `${window.location.origin}/auth?next=${encodeURIComponent(destination)}${recovery ? "&recovery=1" : ""}`;
  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setConfirmationSent(false);
    setPassword("");
    setConfirmPassword("");
    setOtpSent(false);
    setEmailOtp("");
    setMagicEmail("");
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
      if (mode === "magic") {
        if (otpSent) {
          const result = await supabase.auth.verifyOtp({
            email: magicEmail,
            token: emailOtp.trim(),
            type: "email",
          });
          if (result.error) throw result.error;
          if (!result.data.session) throw new Error("No verified session");
          await navigate({ href: destination });
        } else {
          const submittedEmail = email.trim();
          const result = await supabase.auth.signInWithOtp({
            email: submittedEmail,
            options: {
              emailRedirectTo: callback(),
              shouldCreateUser: false,
            },
          });
          if (result.error) throw result.error;
          setMagicEmail(submittedEmail);
          setOtpSent(true);
          setNotice(
            "Confira seu e-mail e abra o link de acesso. Se a mensagem trouxer um código, você também pode informá-lo abaixo.",
          );
        }
      } else if (mode === "reset") {
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
            ? await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
              })
            : await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                  emailRedirectTo: callback(),
                  data: { display_name: name.trim() },
                },
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
    if (busy || !methods?.socialProviders.includes(provider)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const brokerProvider = brokeredOAuth ? lovableOAuthProvider(provider) : undefined;
      if (brokerProvider) {
        const { lovable } = await import("@/integrations/lovable/index");
        const result = await lovable.auth.signInWithOAuth(brokerProvider, {
          redirect_uri: callback(),
        });
        if (result.error) throw result.error;
        if (!result.redirected) await navigate({ href: destination });
      } else {
        const result = await supabase.auth.signInWithOAuth({
          provider,
          options: socialOAuthOptions(provider, callback()),
        });
        if (result.error) throw result.error;
      }
    } catch (cause) {
      setError(authErrorMessage(cause, mode));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithPasskey() {
    if (busy || !methods?.passkeys || !passkeysSupported) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await supabase.auth.signInWithPasskey();
      if (result.error) throw result.error;
      if (!result.data?.session) throw new Error("No passkey session");
      await navigate({ href: destination });
    } catch (cause) {
      setError(passkeyErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: callback(),
        },
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
    magic: "Entrar sem senha",
  }[mode];
  const inputClass =
    "min-h-11 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <main className="auth-stage grid min-h-screen place-items-center px-4 py-10">
      <div className="auth-card grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border/60 bg-card/85 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section
          className="auth-hero relative hidden overflow-hidden border-r border-border/60 p-10 lg:flex lg:flex-col lg:justify-between"
          style={{ backgroundImage: `url(${authHero})` }}
        >
          <div className="relative">
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
          <ul className="relative mt-10 space-y-4 text-sm">
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
          <div className="relative mt-8">
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
                : mode === "magic"
                  ? "Receba um link ou código no e-mail da sua conta."
                  : "Escolha como entrar para continuar sua carreira."}
          </p>
          {methodsLoading && (
            <p role="status" className="mt-5 text-sm text-muted-foreground">
              Carregando formas de entrada…
            </p>
          )}
          {methodsError && (
            <div className="mt-5 rounded-lg border border-border p-3">
              <p role="alert" className="text-sm text-destructive">
                {methodsError}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy || methodsLoading}
                onClick={retryMethods}
                className="mt-2 min-h-11"
              >
                Tentar novamente
              </Button>
            </div>
          )}
          {(mode === "in" || mode === "up") && Boolean(methods?.socialProviders.length) && (
            <div className="mt-5 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {methods?.socialProviders.map((provider) => (
                  <Button
                    key={provider}
                    type="button"
                    variant={provider === "google" ? "default" : "outline"}
                    disabled={busy}
                    className="auth-social min-h-12 w-full font-semibold"
                    onClick={() => signInWith(provider)}
                  >
                    Continuar com {socialProviderLabel(provider)}
                  </Button>
                ))}
              </div>
              {methods?.email && (
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  ou continue com e-mail
                </p>
              )}
            </div>
          )}
          {(mode === "in" || mode === "up") && methods?.passkeys && (
            <div className="mt-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full"
                disabled={busy || !passkeysSupported}
                onClick={signInWithPasskey}
              >
                <Fingerprint size={18} /> Entrar com chave de acesso
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                {passkeysSupported
                  ? "Use uma chave já cadastrada. Para cadastrar a primeira, entre na conta e abra seu perfil."
                  : "Abra o jogo por HTTPS em um navegador com suporte a chaves de acesso."}
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
          {mode === "up" && methods && !methods.signup && (
            <p role="status" className="mt-4 text-sm">
              O cadastro está indisponível no momento. Se você já tem conta, volte para entrar.
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
            (mode === "update" || (methods?.email && (mode !== "up" || methods.signup))) && (
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
                      disabled={busy || (mode === "magic" && otpSent)}
                      onChange={(event) => setEmail(event.target.value)}
                      aria-describedby={error ? "auth-error" : undefined}
                      className={`${inputClass} mt-1`}
                    />
                  </div>
                )}
                {mode === "magic" && otpSent && (
                  <div>
                    <label htmlFor="auth-otp" className="text-sm">
                      Código recebido por e-mail
                    </label>
                    <input
                      id="auth-otp"
                      type="text"
                      required
                      minLength={6}
                      maxLength={64}
                      autoComplete="one-time-code"
                      value={emailOtp}
                      onChange={(event) => setEmailOtp(event.target.value)}
                      aria-describedby={error ? "auth-error" : undefined}
                      className={`${inputClass} mt-1`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      className="mt-2"
                      onClick={() => switchMode("magic")}
                    >
                      Solicitar outro link ou código
                    </Button>
                  </div>
                )}
                {mode !== "reset" && mode !== "magic" && (
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
                        magic: otpSent ? "Validar código e entrar" : "Enviar link de acesso",
                      }[mode]}
                </Button>
              </form>
            )
          )}
          {mode === "in" && methods?.email && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="mt-3 min-h-11 w-full text-sm"
              onClick={() => switchMode("magic")}
            >
              Entrar por link ou código de e-mail
            </Button>
          )}
          {mode === "in" && methods?.email && (
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
            (mode !== "in" || (methods?.email && methods.signup)) && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                className="mt-3 min-h-11 w-full text-sm"
                onClick={() => switchMode(mode === "in" ? "up" : "in")}
              >
                {mode === "in" ? "Não tem conta? Cadastre-se" : "Voltar para entrar"}
              </Button>
            )
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
