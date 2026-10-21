import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { safeAuthNext } from "@/lib/auth-policy";

type Channel = "sms" | "whatsapp";
type MfaFactor = {
  id: string;
  factor_type: "phone" | "totp" | "webauthn";
  status: string;
  friendly_name?: string | null;
  phone?: string | null;
};
type PendingChallenge = { factorId: string; challengeId: string; channel: Channel | "totp" };

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const CODE_PATTERN = /^\d{6,8}$/;

export const Route = createFileRoute("/seguranca")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    next: safeAuthNext(search["next"]),
  }),
  head: () => ({
    meta: [
      { title: "Segurança da conta · Pro Football Manager 3D" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountSecurity,
});

function AccountSecurity() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [currentLevel, setCurrentLevel] = useState<string | null>(null);
  const [nextLevel, setNextLevel] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<PendingChallenge | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSentAt, setLastSentAt] = useState(0);

  async function refresh() {
    const user = await supabase.auth.getUser();
    if (user.error || !user.data.user) {
      setSignedIn(false);
      setFactors([]);
      setCurrentLevel(null);
      return;
    }
    setSignedIn(true);
    const [list, level] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (list.error) throw list.error;
    if (level.error) throw level.error;
    setFactors((list.data.all ?? []) as MfaFactor[]);
    setCurrentLevel(level.data.currentLevel);
    setNextLevel(level.data.nextLevel);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await refresh();
      } catch {
        if (active)
          setError("Não foi possível verificar os fatores de segurança. Tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function execute(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Operação indisponível.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function beginPhoneEnrollment(channel: Channel) {
    await execute(async () => {
      if (!PHONE_PATTERN.test(phone.trim())) {
        setError("Informe o telefone completo no formato +5527999999999.");
        return;
      }
      if (Date.now() - lastSentAt < 60000) {
        setError("Aguarde pelo menos 60 segundos antes de solicitar outro código.");
        return;
      }
      const enroll = await supabase.auth.mfa.enroll({
        factorType: "phone",
        phone: phone.trim(),
        friendlyName: "Telefone de recuperação",
      });
      if (enroll.error) throw enroll.error;
      const challenge = await supabase.auth.mfa.challenge({
        factorId: enroll.data.id,
        channel,
      });
      if (challenge.error) throw challenge.error;
      setPending({ factorId: enroll.data.id, challengeId: challenge.data.id, channel });
      setLastSentAt(Date.now());
      setNotice(`Código solicitado pelo canal ${channel === "sms" ? "SMS" : "WhatsApp"}.`);
    });
  }

  async function beginTotpEnrollment() {
    await execute(async () => {
      const enroll = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Aplicativo autenticador de recuperação",
      });
      if (enroll.error) throw enroll.error;
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.data.id });
      if (challenge.error) throw challenge.error;
      setQrCode(enroll.data.totp.qr_code);
      setTotpSecret(enroll.data.totp.secret);
      setPending({ factorId: enroll.data.id, challengeId: challenge.data.id, channel: "totp" });
      setNotice(
        "Configure o aplicativo autenticador e informe o código. Não compartilhe o segredo.",
      );
    });
  }

  async function challengeExisting(factor: MfaFactor, channel: Channel | "totp") {
    await execute(async () => {
      if (channel !== "totp" && Date.now() - lastSentAt < 60000) {
        setError("Aguarde 60 segundos antes de solicitar outro SMS ou WhatsApp.");
        return;
      }
      const challenge = await supabase.auth.mfa.challenge(
        channel === "totp" ? { factorId: factor.id } : { factorId: factor.id, channel },
      );
      if (challenge.error) throw challenge.error;
      setPending({ factorId: factor.id, challengeId: challenge.data.id, channel });
      if (channel !== "totp") setLastSentAt(Date.now());
      setNotice(channel === "totp" ? "Informe o código do autenticador." : "Código solicitado.");
    });
  }

  async function verifyCode() {
    await execute(async () => {
      if (!pending) return;
      if (!CODE_PATTERN.test(code.trim())) {
        setError("Informe um código numérico válido.");
        return;
      }
      const result = await supabase.auth.mfa.verify({
        factorId: pending.factorId,
        challengeId: pending.challengeId,
        code: code.trim(),
      });
      if (result.error) throw result.error;
      setCode("");
      setPending(null);
      setQrCode("");
      setTotpSecret("");
      await refresh();
      setNotice("Segundo fator verificado. A sessão agora está protegida com MFA.");
      if (next) await navigate({ href: next });
    });
  }

  const verified = factors.filter(
    (factor) => factor.status === "verified" && ["phone", "totp"].includes(factor.factor_type),
  );
  const requiresMfa = currentLevel !== "aal2" && nextLevel === "aal2";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-10">
      <div>
        <Link to="/perfil" className="text-sm text-primary">
          ← Voltar ao perfil
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold">Segurança e recuperação da conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure uma segunda etapa de autenticação por SMS, WhatsApp ou aplicativo autenticador.
          Os canais telefônicos dependem do provedor habilitado no Supabase.
        </p>
      </div>
      {loading ? <p role="status">Verificando sua sessão…</p> : null}
      {!loading && !signedIn ? (
        <p>
          Entre na conta antes de configurar fatores de segurança.{" "}
          <Link to="/auth" className="text-primary underline">
            Ir para o login
          </Link>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-sm">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg border p-3 text-sm">
          {notice}
        </p>
      ) : null}
      {signedIn ? (
        <>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Estado do acesso</h2>
            <p className="mt-1 text-sm">
              Sessão: <strong>{currentLevel ?? "indisponível"}</strong>.
              {requiresMfa
                ? " Sua conta exige verificação adicional antes de concluir o login."
                : currentLevel === "aal2"
                  ? " Verificação de dois fatores concluída."
                  : " MFA opcional enquanto não houver um fator verificado."}
            </p>
            {verified.length > 0 ? (
              <div className="mt-4 space-y-3">
                {verified.map((factor) => (
                  <div key={factor.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">
                      {factor.friendly_name ||
                        (factor.factor_type === "totp" ? "Autenticador" : "Telefone")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {factor.factor_type === "phone" ? (
                        <>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void challengeExisting(factor, "sms")}
                          >
                            Receber SMS
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void challengeExisting(factor, "whatsapp")}
                          >
                            Receber no WhatsApp
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => void challengeExisting(factor, "totp")}
                        >
                          Verificar código do aplicativo
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum fator verificado. Antes de ativar MFA obrigatório, cadastre também um fator
                alternativo.
              </p>
            )}
            {currentLevel === "aal2" && next ? (
              <Button className="mt-4" onClick={() => void navigate({ href: next })}>
                Continuar para o jogo
              </Button>
            ) : null}
          </section>
          {!requiresMfa ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">Adicionar um fator de recuperação</h2>
              <label htmlFor="security-phone" className="mt-3 block text-sm font-medium">
                Número internacional (E.164)
              </label>
              <input
                id="security-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+5527999999999"
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void beginPhoneEnrollment("sms")}>
                  Cadastrar com SMS
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void beginPhoneEnrollment("whatsapp")}
                >
                  Cadastrar com WhatsApp
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void beginTotpEnrollment()}
                >
                  Cadastrar aplicativo autenticador
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                SMS e WhatsApp podem gerar custos. A verificação por telefone não funcionará
                enquanto a Twilio não estiver configurada e liberada no projeto Supabase.
              </p>
            </section>
          ) : null}
          {pending ? (
            <section className="rounded-xl border border-primary bg-card p-5">
              <h2 className="text-lg font-semibold">Confirmar segundo fator</h2>
              {qrCode ? (
                <div className="mt-3">
                  <img
                    src={qrCode}
                    alt="QR code para cadastrar o aplicativo autenticador"
                    width={180}
                    height={180}
                  />
                  <p className="mt-2 break-all text-xs">
                    Código manual, mantenha em segredo: <code>{totpSecret}</code>
                  </p>
                </div>
              ) : null}
              <label htmlFor="mfa-code" className="mt-3 block text-sm font-medium">
                Código recebido {pending.channel === "totp" ? "no aplicativo" : "por mensagem"}
              </label>
              <input
                id="mfa-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={8}
                className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background px-3"
              />
              <div className="mt-3 flex gap-2">
                <Button
                  disabled={busy || !CODE_PATTERN.test(code.trim())}
                  onClick={() => void verifyCode()}
                >
                  Confirmar fator
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setPending(null);
                    setQrCode("");
                    setTotpSecret("");
                    setCode("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </section>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Para recuperar o acesso com MFA, escolha outro fator já cadastrado. Apenas redefinir a
            senha não substitui a verificação de um segundo fator. Se todos os fatores forem
            perdidos, procure o suporte da conta.
          </p>
        </>
      ) : null}
    </main>
  );
}
