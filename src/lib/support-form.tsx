import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { getSupportAvailability, submitSupportRequest } from "./support.functions";
import { SupportRequestInput, type SupportInput } from "./support-input";
import { useT } from "@/i18n/context";
import {
  getSupportCopy,
  formatSupportCharacterCount,
  type SupportCopyKey,
} from "@/i18n/support-copy";
import { supportContentLocale } from "@/i18n/support-locale";

const categories = [
  ["career", "categoryCareer"],
  ["purchase", "categoryPurchase"],
  ["account", "categoryAccount"],
  ["bug", "categoryBug"],
  ["suggestion", "categorySuggestion"],
] as const;
const inputClass =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function SupportForm() {
  const { lang } = useT();
  const copy = getSupportCopy(lang);
  const copyLocale = supportContentLocale(lang);
  const userId = useAuthUserId();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [category, setCategory] = useState<SupportInput["category"]>("bug");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<SupportCopyKey | null>(null);
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
      setFeedback("invalidLength");
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      const result = await submitSupportRequest({ data: parsed.data });
      if (result.ok) {
        setReceipt(result.requestId);
        setMessage("");
        intent.current = null;
      } else {
        setFeedback(
          result.reason === "rate_limited"
            ? "rateLimited"
            : result.reason === "verification_required"
              ? "verificationRequired"
              : result.reason === "pending"
                ? "pending"
                : "deliveryUnconfirmed",
        );
      }
    } catch {
      setFeedback("deliveryError");
    } finally {
      setSending(false);
    }
  }

  if (enabled === null || userId === undefined)
    return (
      <p role="status" className="mt-3 text-sm text-muted-foreground" lang={copyLocale}>
        {copy.checking}
      </p>
    );
  if (!enabled)
    return (
      <p role="status" className="mt-3 text-sm text-muted-foreground" lang={copyLocale}>
        {copy.unavailable}
      </p>
    );
  if (!userId)
    return (
      <p className="mt-3 text-sm text-muted-foreground" lang={copyLocale}>
        <Link to="/auth" search={{ next: "/contato" }} className="text-primary underline">
          {copy.signIn}
        </Link>{" "}
        {copy.signInDescription}
      </p>
    );
  if (receipt)
    return (
      <div role="status" className="mt-4 space-y-3 text-sm" lang={copyLocale}>
        <p>
          {copy.delivered} <span className="break-all font-mono">{receipt}</span>.
        </p>
        <p className="text-muted-foreground">{copy.deliveryExplanation}</p>
        <button
          type="button"
          onClick={() => setReceipt(null)}
          className="min-h-11 rounded-lg border border-border px-4 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {copy.another}
        </button>
      </div>
    );
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-4 space-y-4"
      aria-busy={sending}
      lang={copyLocale}
      noValidate
    >
      <div>
        <label htmlFor="support-category" className="text-sm font-medium">
          {copy.subject}
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
              {copy[label]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="support-message" className="text-sm font-medium">
          {copy.message}
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
          {formatSupportCharacterCount(lang, message.length)}
        </p>
        <p id="support-help" className="mt-2 text-xs text-muted-foreground">
          {copy.help}
        </p>
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="support-website">{copy.website}</label>
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
          {copy[feedback]}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {sending ? copy.sending : copy.submit}
      </button>
      <p className="text-xs text-muted-foreground">
        {copy.privacyDescription}{" "}
        <Link to="/privacidade" className="text-primary underline">
          {copy.privacyPolicy}
        </Link>
        .
      </p>
    </form>
  );
}
