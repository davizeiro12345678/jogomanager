import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const E164 = /^\+[1-9]\d{7,14}$/;

export function VerifiedPhoneSettings() {
  const [phone, setPhone] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [challengePhone, setChallengePhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setHasPhone(Boolean(data.user?.phone));
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const normalized = phone.trim();
    if (!E164.test(normalized)) {
      setNotice("Use telefone internacional, por exemplo +5511999999999.");
      return;
    }
    if (challengePhone && challengePhone !== normalized) {
      setNotice("Confirme o número original ou solicite uma alteração nova.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error) throw assurance.error;
      if (assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
        setNotice("Confirme seu segundo fator antes de modificar o telefone da conta.");
        return;
      }
      if (challengePhone) {
        if (!/^\d{4,10}$/.test(code.trim())) {
          setNotice("Informe um código de confirmação numérico.");
          return;
        }
        const result = await supabase.auth.verifyOtp({
          phone: normalized,
          token: code.trim(),
          type: "phone_change",
        });
        if (result.error) throw result.error;
        setHasPhone(true);
        setChallengePhone("");
        setCode("");
        setPhone("");
        setNotice("Telefone confirmado. Agora você pode entrar com código telefônico.");
        return;
      }
      const result = await supabase.auth.updateUser({ phone: normalized });
      if (result.error) throw result.error;
      setChallengePhone(normalized);
      setNotice("Se o envio estiver habilitado, você receberá um código de confirmação.");
    } catch {
      setNotice("A alteração do telefone não foi concluída. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-card mt-5 space-y-3 p-5" aria-labelledby="verified-phone-heading">
      <h2 id="verified-phone-heading" className="font-display text-lg font-bold">
        Telefone da conta
      </h2>
      <p className="text-sm text-muted-foreground">
        {hasPhone
          ? "Você tem um telefone cadastrado. É possível substituí-lo após confirmar o novo número."
          : "Cadastre e confirme um telefone para poder usar o acesso por SMS ou WhatsApp."}
      </p>
      <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm">
          Número internacional
          <input
            className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
            autoComplete="tel"
            inputMode="tel"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+5511999999999"
            maxLength={16}
            required
          />
        </label>
        {challengePhone && (
          <label className="block text-sm">
            Código recebido
            <input
              className="mt-1 min-h-11 w-full rounded border border-input bg-background px-3"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={10}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {challengePhone ? "Confirmar telefone" : "Solicitar código de confirmação"}
        </button>
      </form>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
