import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const PHONE_NUMBER = /^\+[1-9]\d{7,14}$/;

type PhoneChannel = "sms" | "whatsapp";

export function PhoneAuthPanel({ destination }: { destination: string }) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<PhoneChannel>("sms");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [lastRequest, setLastRequest] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!PHONE_NUMBER.test(phone.trim())) {
      setNotice("Informe um telefone internacional, como +5511999999999.");
      return;
    }
    if (sentTo && sentTo !== phone.trim()) {
      setSentTo("");
      setCode("");
    }
    setBusy(true);
    setNotice("");
    try {
      if (sentTo === phone.trim() && sentTo.length > 0 && code.trim()) {
        if (!/^\d{4,10}$/.test(code.trim())) {
          setNotice("Digite um código numérico válido.");
          return;
        }
        const result = await supabase.auth.verifyOtp({
          phone: sentTo,
          token: code.trim(),
          type: "sms",
        });
        if (result.error) throw result.error;
        if (!result.data.session) throw new Error("A sessão não foi confirmada.");
        await navigate({ href: destination });
        return;
      }
      if (Date.now() - lastRequest < 60_000) {
        setNotice("Aguarde um minuto para solicitar outro código.");
        return;
      }
      const result = await supabase.auth.signInWithOtp({
        phone: phone.trim(),
        options: { channel, shouldCreateUser: false },
      });
      if (result.error) throw result.error;
      setSentTo(phone.trim());
      setLastRequest(Date.now());
      setNotice(
        "Se o número estiver vinculado a uma conta, o código será enviado pelo canal selecionado.",
      );
    } catch {
      setNotice("Não foi possível concluir a verificação. Confira o número e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Entrar com telefone"
      className="mt-5 rounded-xl border border-border/60 p-4"
    >
      <h2 className="font-display text-lg font-semibold">Entrar com telefone</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Apenas contas com telefone previamente confirmado podem entrar por SMS ou WhatsApp.
      </p>
      <form className="mt-3 space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          Telefone internacional
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background p-2"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+5511999999999"
            value={phone}
            maxLength={16}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Receber por
          <select
            className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background p-2"
            value={channel}
            onChange={(event) => setChannel(event.target.value as PhoneChannel)}
          >
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        {sentTo === phone.trim() && sentTo.length > 0 && (
          <label className="block text-sm">
            Código de acesso
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-input bg-background p-2"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              maxLength={10}
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
        )}
        <button
          className="min-h-11 w-full rounded-lg bg-primary p-2 text-primary-foreground disabled:opacity-50"
          type="submit"
          disabled={busy}
        >
          {busy ? "Aguarde..." : code ? "Confirmar código" : "Solicitar código"}
        </button>
      </form>
      {notice && (
        <p role="status" className="mt-3 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
