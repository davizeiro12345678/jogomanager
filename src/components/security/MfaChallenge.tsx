import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { needsMfaChallenge } from "@/lib/mfa-session";

type Factor = { id: string; factor_type: string; friendly_name?: string; status: string };

/** Used after password, OAuth, passkey, OTP and password-recovery sessions. */
export function MfaChallenge({ onVerified }: { onVerified: () => void | Promise<void> }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Carregando seus fatores de segurança…");
  useEffect(() => {
    let active = true;
    void supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setNotice("Não foi possível carregar seus fatores. Entre novamente para tentar.");
          return;
        }
        const available = data.all.filter(
          (f) =>
            f.status === "verified" &&
            (f.factor_type === "totp" ||
              (f.factor_type === "phone" && import.meta.env.VITE_PHONE_MFA_ENABLED === "true")),
        );
        setFactors(available);
        setFactorId(available[0]?.id ?? "");
        setNotice(
          available.length
            ? "Confirme seu segundo fator para continuar."
            : "Nenhum fator compatível está disponível. Use seu dispositivo de reserva ou procure o suporte.",
        );
      })
      .catch(() => {
        if (active) setNotice("Não foi possível consultar seus fatores de segurança.");
      });
    return () => {
      active = false;
    };
  }, []);
  const selected = factors.find((f) => f.id === factorId);
  const send = async () => {
    if (busy || !selected || Date.now() < cooldown) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.challenge({ factorId, channel: "sms" });
      if (error || !data) throw error;
      setChallengeId(data.id);
      setCooldown(Date.now() + 60_000);
      setNotice("Código enviado. Aguarde um minuto antes de solicitar outro.");
    } catch {
      setNotice("Não foi possível enviar. Tente outro fator ou aguarde.");
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !selected || !/^\d{6}$/.test(code.trim())) return;
    setBusy(true);
    try {
      if (selected.factor_type === "totp") {
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId,
          code: code.trim(),
        });
        if (error) throw error;
      } else {
        if (!challengeId) throw Error("Missing challenge");
        const { error } = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code: code.trim(),
        });
        if (error) throw error;
      }
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !data || needsMfaChallenge(data) || data.currentLevel !== "aal2")
        throw Error("MFA required");
      setCode("");
      await onVerified();
    } catch {
      setNotice("Código inválido, expirado ou verificação indisponível. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="surface-card mx-auto max-w-md space-y-4 p-6" aria-labelledby="mfa-title">
      <h1 id="mfa-title" className="font-display text-xl">
        Confirme sua identidade
      </h1>
      <p role="status" className="text-sm">
        {notice}
      </p>
      <form onSubmit={(event) => void verify(event)} className="space-y-3">
        <label className="block text-sm">
          Dispositivo de segurança
          <select
            className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            value={factorId}
            onChange={(event) => {
              setFactorId(event.target.value);
              setCode("");
              setChallengeId("");
            }}
            disabled={busy}
          >
            {factors.map((f, i) => (
              <option key={f.id} value={f.id}>
                {f.friendly_name ||
                  `${f.factor_type === "totp" ? "Aplicativo autenticador" : "Telefone"} ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        {selected?.factor_type === "phone" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="min-h-11 rounded border px-4"
          >
            Enviar código por SMS
          </button>
        )}
        <label className="block text-sm">
          Código de seis dígitos
          <input
            className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            required
          />
        </label>
        <button
          type="submit"
          disabled={busy || !selected}
          className="min-h-11 rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
        >
          Verificar e continuar
        </button>
      </form>
      <p className="text-xs text-muted-foreground">
        Você pode escolher outro autenticador já cadastrado. Recuperar a senha por e-mail não remove
        o segundo fator.
      </p>
      <button
        type="button"
        disabled={busy}
        className="min-h-11 underline"
        onClick={() =>
          void import("@/lib/logout").then(async (m) => {
            await m.signOutAndCleanDevice();
            window.location.assign("/auth");
          })
        }
      >
        Sair desta conta
      </button>
    </section>
  );
}
