import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Mail, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getGuestCheckoutStatus } from "@/lib/guest-checkout.functions";
import { supabase } from "@/integrations/supabase/client";

const MAGIC_LINK_RESEND_COOLDOWN_SECONDS = 60;

function guestCheckoutStorageKey(intent: string, suffix: "email" | "magic-link-cooldown") {
  return "pfm3d.guest-checkout." + intent + "." + suffix;
}

function validIntent(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function validSession(value: unknown): value is string {
  return typeof value === "string" && /^cs_[a-zA-Z0-9_]+$/.test(value);
}

function formatResendCooldown(seconds: number) {
  return seconds + " " + (seconds === 1 ? "segundo" : "segundos");
}

function futureTimestamp(value: string | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > Date.now() ? parsed : null;
}

export const Route = createFileRoute("/checkout/guest")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { intent?: string; session_id?: string } => ({
    ...(validIntent(search["intent"]) ? { intent: search["intent"] } : {}),
    ...(validSession(search["session_id"]) ? { session_id: search["session_id"] } : {}),
  }),
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: GuestCheckoutReturn,
});

function GuestCheckoutReturn() {
  const { intent, session_id: sessionId } = Route.useSearch();
  const getStatus = useServerFn(getGuestCheckoutStatus);
  const [status, setStatus] = useState<"loading" | "pending" | "paid" | "error">(
    intent && sessionId ? "loading" : "error",
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendCooldownEndsAt, setResendCooldownEndsAt] = useState<number | null>(null);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const cooldownNow = Date.now();
  const resendCooldownActive = resendCooldownEndsAt !== null && resendCooldownEndsAt > cooldownNow;
  const displayedCooldownSeconds = resendCooldownActive
    ? Math.max(resendCooldownSeconds, Math.ceil((resendCooldownEndsAt - cooldownNow) / 1_000))
    : 0;

  const refresh = useCallback(async () => {
    if (!intent || !sessionId) {
      setStatus("error");
      setMessage("Não encontramos esta compra visitante.");
      return;
    }
    setStatus("loading");
    try {
      const result = await getStatus({ data: { intentId: intent, sessionId } });
      if (result.status === "paid") {
        setStatus("paid");
        return;
      }
      if (result.status === "pending") {
        setStatus("pending");
        return;
      }
      setStatus("error");
      setMessage(
        "message" in result ? result.message : "Não foi possível confirmar esta compra agora.",
      );
    } catch {
      setStatus("error");
      setMessage("Não foi possível confirmar esta compra agora.");
    }
  }, [getStatus, intent, sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSent(false);
    setResendCooldownEndsAt(null);
    setMessage("");

    if (!intent) {
      setEmail("");
      return;
    }

    const remembered = window.sessionStorage.getItem(guestCheckoutStorageKey(intent, "email"));
    setEmail(remembered ?? "");

    const cooldownKey = guestCheckoutStorageKey(intent, "magic-link-cooldown");
    const restoredCooldown = sessionId
      ? futureTimestamp(window.sessionStorage.getItem(cooldownKey))
      : null;
    if (restoredCooldown) {
      setSent(true);
      setResendCooldownEndsAt(restoredCooldown);
    } else {
      window.sessionStorage.removeItem(cooldownKey);
    }
  }, [intent, sessionId]);

  useEffect(() => {
    if (!resendCooldownEndsAt) {
      setResendCooldownSeconds(0);
      return;
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, Math.ceil((resendCooldownEndsAt - Date.now()) / 1000));
      setResendCooldownSeconds(remaining);
      if (remaining === 0) {
        if (intent) {
          window.sessionStorage.removeItem(guestCheckoutStorageKey(intent, "magic-link-cooldown"));
        }
        setResendCooldownEndsAt(null);
      }
    };
    updateCooldown();
    const intervalId = window.setInterval(updateCooldown, 1_000);
    return () => window.clearInterval(intervalId);
  }, [intent, resendCooldownEndsAt]);

  async function requestMagicLink(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!intent || !sessionId || sending) return;
    if (resendCooldownEndsAt !== null && resendCooldownEndsAt > Date.now()) return;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setMessage("Informe o e-mail usado no pagamento para receber o link seguro.");
      return;
    }

    setSending(true);
    setMessage("");
    const redirectTo =
      window.location.origin +
      "/checkout/claim?intent=" +
      encodeURIComponent(intent) +
      "&session_id=" +
      encodeURIComponent(sessionId);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) {
        setMessage("Não foi possível enviar o link. Confira o e-mail e tente novamente.");
        return;
      }

      const cooldownEndsAt = Date.now() + MAGIC_LINK_RESEND_COOLDOWN_SECONDS * 1_000;
      window.sessionStorage.setItem(guestCheckoutStorageKey(intent, "email"), normalizedEmail);
      window.sessionStorage.setItem(
        guestCheckoutStorageKey(intent, "magic-link-cooldown"),
        String(cooldownEndsAt),
      );
      setSent(true);
      setResendCooldownEndsAt(cooldownEndsAt);
    } catch {
      setMessage("Não foi possível enviar o link. Confira o e-mail e tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="pitch-bg grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        {status === "loading" ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Confirmando pagamento</h1>
            <p className="mt-2 text-sm text-muted-foreground">Isso pode levar alguns segundos.</p>
          </div>
        ) : null}

        {status === "pending" ? (
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 font-display text-2xl uppercase">Pagamento em confirmação</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Assim que o banco confirmar, volte aqui para receber o link de acesso.
            </p>
            <Button className="mt-5" variant="outline" onClick={() => void refresh()}>
              <RefreshCw size={16} /> Verificar novamente
            </Button>
          </div>
        ) : null}

        {status === "paid" ? (
          <>
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h1 className="mt-4 font-display text-2xl uppercase">Pagamento confirmado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Envie um link seguro para o mesmo e-mail usado no pagamento. Ele cria ou abre sua
                conta e entrega o item automaticamente.
              </p>
            </div>
            {sent ? (
              <div className="mt-6 rounded-xl border border-primary/35 bg-primary/10 p-4 text-sm">
                <div role="status" aria-live="polite">
                  <p className="font-medium">Confira sua caixa de entrada</p>
                  <p className="mt-1 text-muted-foreground">
                    O link abre esta compra e finaliza a entrega na sua conta.
                  </p>
                </div>
                {message ? (
                  <p role="alert" className="mt-3 text-destructive">
                    {message}
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="mt-4 w-full"
                  variant="outline"
                  onClick={() => void requestMagicLink()}
                  disabled={sending || resendCooldownActive}
                  aria-describedby="magic-link-resend-status"
                >
                  <Mail size={16} />
                  {sending
                    ? "Enviando link…"
                    : resendCooldownActive
                      ? "Reenviar disponível em " + formatResendCooldown(displayedCooldownSeconds)
                      : "Reenviar link seguro"}
                </Button>
                <p id="magic-link-resend-status" className="mt-3 text-xs text-muted-foreground">
                  <span role="status" aria-live="polite">
                    {resendCooldownActive
                      ? "Por segurança, o reenvio está temporariamente indisponível."
                      : "Você pode pedir outro link caso não o encontre na caixa de entrada."}
                  </span>
                  {resendCooldownActive ? (
                    <span aria-hidden="true">
                      {" "}
                      Disponível em {formatResendCooldown(displayedCooldownSeconds)}.
                    </span>
                  ) : null}
                </p>
                <Button
                  type="button"
                  className="mt-2 w-full"
                  variant="ghost"
                  disabled={sending}
                  onClick={() => {
                    setSent(false);
                    setMessage("");
                  }}
                >
                  Usar outro e-mail
                </Button>
              </div>
            ) : (
              <form className="mt-6 space-y-3" onSubmit={(event) => void requestMagicLink(event)}>
                <label className="block text-sm font-medium" htmlFor="claim-email">
                  Mesmo e-mail usado no pagamento
                </label>
                <input
                  id="claim-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setMessage("");
                  }}
                  placeholder="voce@email.com"
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {message ? (
                  <p role="alert" className="text-sm text-destructive">
                    {message}
                  </p>
                ) : null}
                {resendCooldownActive ? (
                  <p role="status" className="text-xs text-muted-foreground">
                    Por segurança, aguarde {formatResendCooldown(displayedCooldownSeconds)} para
                    pedir outro link.
                  </p>
                ) : null}
                <Button type="submit" className="w-full" disabled={sending || resendCooldownActive}>
                  <Mail size={16} /> {sending ? "Enviando link…" : "Enviar link seguro"}
                </Button>
              </form>
            )}
          </>
        ) : null}

        {status === "error" ? (
          <div className="text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 font-display text-2xl uppercase">Compra não encontrada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message || "Este link é inválido ou expirou."}
            </p>
          </div>
        ) : null}

        <div className="mt-7 flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link to="/produtos">Voltar aos produtos</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/auth">Já tenho uma conta</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
