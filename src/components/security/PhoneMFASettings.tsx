import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const E164 = /^\+[1-9]\d{7,14}$/;
// Intentionally disabled until Twilio Verify service, approved messaging channels,
// Supabase phone auth, fraud limits and real delivery tests are configured.
const ENABLED = import.meta.env["VITE_PHONE_MFA_ENABLED"] === "true";
type Channel = "sms" | "whatsapp";
type PhoneFactor = { id: string; status: string; phone?: string };

export function PhoneMFASettings() {
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("sms");
  const [factor, setFactor] = useState<PhoneFactor | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState(0);

  useEffect(() => {
    if (!ENABLED) return;
    let active = true;
    void supabase.auth.mfa.listFactors().then(({ data }) => {
      if (active && data?.phone?.length) {
        const enrolled = data.phone.find((item) => item.status === "verified");
        if (enrolled)
          setFactor({ id: enrolled.id, status: enrolled.status, phone: enrolled.phone });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!ENABLED) return null;

  const report = (cause: unknown) =>
    setNotice(
      cause instanceof Error
        ? "Verificação indisponível. Tente novamente ou utilize outro fator."
        : "Não foi possível verificar seu segundo fator.",
    );

  const challenge = async (id: string) => {
    if (Date.now() < cooldownUntil) {
      setNotice("Aguarde 60 segundos antes de solicitar outro código.");
      return;
    }
    const { data, error } = await supabase.auth.mfa.challenge({ factorId: id, channel });
    if (error) throw error;
    if (!data) throw Error("Empty challenge");
    setChallengeId(data.id);
    setCooldownUntil(Date.now() + 60_000);
    setNotice(`Enviamos uma verificação por ${channel === "sms" ? "SMS" : "WhatsApp"}.`);
  };

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (factor) return await challenge(factor.id);
      if (!E164.test(phone.trim())) {
        setNotice("Use telefone internacional no formato +5511999999999.");
        return;
      }
      const result = await supabase.auth.mfa.enroll({
        factorType: "phone",
        phone: phone.trim(),
      });
      if (result.error) throw result.error;
      if (!result.data) throw Error("Missing factor");
      setFactor({ id: result.data.id, status: "unverified", phone: phone.trim() });
      await challenge(result.data.id);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy || !factor || !challengeId) return;
    if (!/^\d{4,10}$/.test(otp.trim())) {
      setNotice("Informe o código numérico recebido.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const result = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId,
        code: otp.trim(),
      });
      if (result.error) throw result.error;
      setFactor({ ...factor, status: "verified" });
      setChallengeId("");
      setOtp("");
      setNotice("Segundo fator confirmado. Sua sessão está protegida com MFA.");
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface-card mt-5 space-y-3 p-5" aria-labelledby="phone-mfa-heading">
      <h2 id="phone-mfa-heading" className="font-display text-lg font-bold">
        Verificação em duas etapas
      </h2>
      <p className="text-sm text-muted-foreground">
        Um código por SMS ou WhatsApp ajuda a proteger sua conta. Nunca informe o código a
        terceiros.
      </p>
      {factor?.status === "verified" && (
        <p className="text-sm text-green-500">Telefone autenticado como segundo fator.</p>
      )}
      {!factor && (
        <label className="block text-sm">
          Telefone (formato internacional)
          <input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            placeholder="+5511999999999"
            maxLength={16}
          />
        </label>
      )}
      <label className="block text-sm">
        Canal do código
        <select
          className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
          value={channel}
          onChange={(e) => setChannel(e.target.value as Channel)}
        >
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void send()}
        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {factor ? "Solicitar novo código" : "Ativar segundo fator"}
      </button>
      {challengeId && (
        <div className="space-y-2">
          <label className="block text-sm">
            Código de verificação
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              maxLength={10}
              onChange={(e) => setOtp(e.target.value)}
              className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void verify()}
            className="min-h-11 rounded-lg border border-primary px-4 py-2 disabled:opacity-50"
          >
            Confirmar código
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
