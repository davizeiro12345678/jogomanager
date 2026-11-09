import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { getSupportAvailability, submitSupportRequest } from "./support.functions";
import { SupportRequestInput, type SupportInput } from "./support-input";

const categories = [
  ["career", "Carreira e progresso"],
  ["purchase", "Compra e benefícios"],
  ["account", "Conta e privacidade"],
  ["bug", "Erro no jogo"],
  ["suggestion", "Sugestão"],
] as const;
const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function SupportForm() {
  const userId = useAuthUserId();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [category, setCategory] = useState<SupportInput["category"]>("bug");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [invalidMessage, setInvalidMessage] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const intent = useRef<{ fingerprint: string; id: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void getSupportAvailability()
      .then((value) => {
        if (alive) setEnabled(value.enabled);
      })
      .catch(() => {
        if (alive) setEnabled(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !enabled || !userId) return;
    const fingerprint = JSON.stringify([userId, category, message]);
    if (intent.current?.fingerprint !== fingerprint)
      intent.current = { fingerprint, id: crypto.randomUUID() };
    const parsed = SupportRequestInput.safeParse({
      requestId: intent.current.id,
      category,
      message,
      website,
    });
    setInvalidMessage(!parsed.success);
    if (!parsed.success) {
      setFeedback("Descreva o problema com 20 a 4.000 caracteres.");
      return;
    }
    setSending(true);
    setFeedback("");
    try {
      const result = await submitSupportRequest({ data: parsed.data });
      if (result.ok) {
        setReceipt(result.requestId);
        setMessage("");
        intent.current = null;
      } else {
        setFeedback(
          result.reason === "rate_limited"
            ? "O limite é de três solicitações por hora. Aguarde antes de enviar outra."
            : result.reason === "verification_required"
              ? "Confirme o e-mail da sua conta antes de enviar. Você também pode usar os contatos abaixo."
              : result.reason === "pending"
                ? "Sua solicitação está sendo processada. Aguarde 30 segundos antes de tentar novamente."
                : "Não foi possível confirmar a entrega. Aguarde 30 segundos e tente novamente, ou use o e-mail abaixo.",
        );
      }
    } catch {
      setFeedback(
        "Não foi possível confirmar a entrega. Preserve a descrição e tente novamente, ou use o e-mail abaixo.",
      );
    } finally {
      setSending(false);
    }
  }

  if (enabled === null || userId === undefined)
    return (
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        Verificando o atendimento…
      </p>
    );
  if (!enabled)
    return (
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        O formulário está temporariamente indisponível. Os contatos oficiais abaixo continuam
        disponíveis.
      </p>
    );
  if (!userId)
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        <Link to="/auth" search={{ next: "/contato" }} className="text-primary underline">
          Entre na sua conta
        </Link>{" "}
        para vincular a solicitação ao seu acesso, ou use o e-mail abaixo.
      </p>
    );
  if (receipt)
    return (
      <div role="status" className="mt-4 space-y-3 text-sm">
        <p>
          Solicitação encaminhada ao suporte. Protocolo:{" "}
          <span className="break-all font-mono">{receipt}</span>.
        </p>
        <p className="text-muted-foreground">
          A confirmação é de entrega; o prazo de resposta depende do assunto e do volume de
          solicitações.
        </p>
        <button
          type="button"
          onClick={() => setReceipt(null)}
          className="min-h-11 rounded-lg border border-border px-4 focus-visible:outline-2 focus-visible:outline-primary"
        >
          Enviar outra solicitação
        </button>
      </div>
    );
  return (
    <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4" aria-busy={sending}>
      <div>
        <label htmlFor="support-category" className="text-sm font-medium">
          Assunto
        </label>
        <select
          id="support-category"
          value={category}
          onChange={(event) => setCategory(event.target.value as SupportInput["category"])}
          disabled={sending}
          className={inputClass}
        >
          {categories.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="support-message" className="text-sm font-medium">
          Descreva o que aconteceu
        </label>
        <textarea
          id="support-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          minLength={20}
          maxLength={4000}
          rows={6}
          required
          disabled={sending}
          aria-describedby={`support-help support-count${feedback ? " support-feedback" : ""}`}
          aria-invalid={invalidMessage ? true : undefined}
          className={inputClass}
        />
        <p id="support-count" className="mt-1 text-xs text-muted-foreground">
          {message.length}/4.000 caracteres; mínimo de 20.
        </p>
        <p id="support-help" className="mt-2 text-xs text-muted-foreground">
          Informe página, aparelho, navegador e passos para reproduzir. Sua conta e seu e-mail
          confirmado acompanham a mensagem. Não inclua senha, códigos, cartão ou arquivos de
          carreira completos.
        </p>
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="support-website">Website</label>
        <input
          id="support-website"
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          maxLength={100}
        />
      </div>
      {feedback && (
        <p id="support-feedback" role="alert" className="text-sm text-destructive">
          {feedback}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {sending ? "Enviando…" : "Enviar ao suporte"}
      </button>
      <p className="text-xs text-muted-foreground">
        Ao enviar, você encaminha estes dados ao atendimento do jogo.{" "}
        <Link to="/privacidade" className="text-primary underline">
          Política de privacidade
        </Link>
        .
      </p>
    </form>
  );
}
