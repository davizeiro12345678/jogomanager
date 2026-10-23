import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { needsMfaChallenge } from "@/lib/mfa-session";
import { MfaChallenge } from "./MfaChallenge";

type Factor = { id: string; friendly_name?: string; status: string };
type Enrollment = { id: string; qr: string; secret: string };

export function AuthenticatorSettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (active && !error && data) setFactors(data.totp.filter((f) => f.status === "verified"));
        else if (active) setNotice("Não foi possível consultar os autenticadores.");
      })
      .catch(() => {
        if (active) setNotice("Verificação indisponível. Tente novamente.");
      });
    return () => {
      active = false;
    };
  }, []);
  const assertAssurance = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) throw error;
    if (needsMfaChallenge(data)) {
      setStepUp(true);
      return false;
    }
    return true;
  };
  const enroll = async () => {
    if (busy || enrollment) return;
    setBusy(true);
    setNotice("");
    try {
      if (!(await assertAssurance())) return;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "JogoManager",
        friendlyName: name.trim() || `Autenticador ${crypto.randomUUID().slice(0, 8)}`,
      });
      if (error || !data) throw error;
      setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setNotice("Escaneie o QR no seu aplicativo e confirme o primeiro código.");
    } catch {
      setNotice("Não foi possível iniciar o cadastro do autenticador.");
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (busy || !enrollment || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.id,
        code,
      });
      if (error) throw error;
      setEnrollment(null);
      setCode("");
      setName("");
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError || !data) throw listError;
      setFactors(data.totp.filter((f) => f.status === "verified"));
      setNotice(
        "Autenticador confirmado. Cadastre também um dispositivo de reserva e guarde-o em local separado.",
      );
    } catch {
      setNotice("Código não confirmado. Confira o relógio do aplicativo e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await assertAssurance())) return;
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      setFactors((list) => list.filter((f) => f.id !== id));
      if (enrollment?.id === id) {
        setEnrollment(null);
        setCode("");
      }
      setNotice("Autenticador removido.");
    } catch {
      setNotice("Não foi possível remover. Confirme seu segundo fator e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  if (stepUp) return <MfaChallenge onVerified={() => setStepUp(false)} />;
  return (
    <section className="surface-card mt-5 space-y-3 p-5" aria-labelledby="authenticator-title">
      <h2 id="authenticator-title" className="font-display text-lg">
        Aplicativo autenticador
      </h2>
      <p className="text-sm text-muted-foreground">
        Proteja sua conta com códigos do Google Authenticator, Authy ou outro aplicativo compatível,
        sem depender de SMS.
      </p>
      {factors.map((factor) => (
        <div key={factor.id} className="flex items-center justify-between gap-3">
          <span>{factor.friendly_name || "Autenticador confirmado"}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove(factor.id)}
            className="min-h-11 underline"
          >
            Remover autenticador
          </button>
        </div>
      ))}
      {!enrollment ? (
        <>
          <label className="block text-sm">
            Nome do dispositivo
            <input
              className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
              value={name}
              maxLength={64}
              onChange={(event) => setName(event.target.value)}
              placeholder="Meu celular ou dispositivo de reserva"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void enroll()}
            className="min-h-11 rounded bg-primary px-4 text-primary-foreground"
          >
            {factors.length ? "Adicionar autenticador de reserva" : "Configurar autenticador"}
          </button>
        </>
      ) : (
        <>
          <img
            src={
              enrollment.qr.startsWith("data:image/svg+xml")
                ? enrollment.qr
                : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qr)}`
            }
            width={224}
            height={224}
            alt="QR de cadastro do seu autenticador"
            className="rounded bg-white p-2"
          />
          <details>
            <summary>Configurar com chave manual</summary>
            <code className="break-all select-all">{enrollment.secret}</code>
            <p className="text-xs">Guarde esta chave em segurança. Nunca envie a terceiros.</p>
          </details>
          <label className="block text-sm">
            Código do aplicativo
            <input
              className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void confirm()}
            className="min-h-11 rounded bg-primary px-4 text-primary-foreground"
          >
            Confirmar autenticador
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void remove(enrollment.id)}
            className="ml-3 min-h-11 underline"
          >
            Cancelar cadastro
          </button>
        </>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
