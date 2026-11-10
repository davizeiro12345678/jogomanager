import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { submitSupportTicket } from "@/lib/support.functions";
import { SupportTicketInput } from "@/lib/support-input";
import { useT } from "@/i18n/provider";
import { supportMessages } from "@/i18n/support-messages";

const CATEGORIES = ["gameplay", "account", "purchase", "privacy", "report"] as const;
type Category = (typeof CATEGORIES)[number];
type Submission = { requestId: string; category: Category; subject: string; message: string };

export function SupportTicketForm() {
  const { lang } = useT();
  const copy = supportMessages(lang);
  const userId = useAuthUserId();
  const submit = useServerFn(submitSupportTicket);
  const [formOwner, setFormOwner] = useState(userId);
  const [category, setCategory] = useState<Category>("gameplay");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [ticket, setTicket] = useState<{
    id: string;
    status: "queued" | "delivered" | "delivery_failed";
  } | null>(null);
  const identity = useRef({ owner: userId, generation: 0 });
  if (identity.current.owner !== userId)
    identity.current = { owner: userId, generation: identity.current.generation + 1 };
  useEffect(() => {
    setCategory("gameplay");
    setAttempt(null);
    setSubject("");
    setMessage("");
    setTicket(null);
    setBusy(false);
    setNotice("");
    setFormOwner(userId);
  }, [userId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || ticket) return;
    const token = identity.current;
    const isCurrent = () => token === identity.current;
    const raw = attempt ?? {
      requestId: crypto.randomUUID(),
      category,
      subject: subject.trim(),
      message: message.trim(),
    };
    const parsed = SupportTicketInput.safeParse(raw);
    if (!parsed.success) {
      setNotice(copy.invalid);
      return;
    }
    const data = parsed.data;
    setAttempt(data);
    setBusy(true);
    setNotice("");
    try {
      const result = await submit({ data });
      if (!isCurrent()) return;
      if (result.ok) {
        setTicket({ id: result.ticketId, status: result.status });
      } else {
        const messages = {
          unavailable: copy.unavailable,
          rate_limited: copy.rateLimited,
          verification_required: copy.verification,
          error: copy.error,
        };
        setNotice(messages[result.reason]);
        if (result.reason !== "error") setAttempt(null);
      }
    } catch {
      if (isCurrent()) setNotice(copy.connectionError);
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  if (userId === undefined || formOwner !== userId)
    return (
      <p role="status" className="mt-4 text-sm">
        {copy.checking}
      </p>
    );
  if (!userId)
    return (
      <div className="mt-4 rounded-xl border border-border p-4 text-sm">
        <p>{copy.signedOut}</p>
        <Link
          to="/auth"
          search={{ next: "/contato" }}
          className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
        >
          {copy.signIn}
        </Link>
      </div>
    );
  if (ticket)
    return (
      <div
        role="status"
        className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm"
      >
        <p className="font-medium">
          {ticket.status === "delivered"
            ? copy.deliveredTitle
            : ticket.status === "delivery_failed"
              ? copy.failedTitle
              : copy.queuedTitle}
        </p>
        <p className="mt-2 break-all">
          {copy.protocol} <span className="font-mono">{ticket.id}</span>
        </p>
        <p className="mt-2 text-muted-foreground">
          {ticket.status === "queued"
            ? copy.queuedDetail
            : ticket.status === "delivery_failed"
              ? copy.failedDetail
              : copy.deliveredDetail}
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-lg border border-border px-4"
          onClick={() => {
            setTicket(null);
            setAttempt(null);
            setSubject("");
            setMessage("");
          }}
        >
          {copy.another}
        </button>
      </div>
    );
  const locked = busy || attempt !== null;
  return (
    <form onSubmit={send} className="mt-5 space-y-4">
      <div>
        <label htmlFor="support-category" className="text-sm font-medium">
          {copy.category}
        </label>
        <select
          id="support-category"
          value={category}
          disabled={locked}
          onChange={(event) => setCategory(event.target.value as Category)}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {copy[value]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="support-subject" className="text-sm font-medium">
          {copy.subject}
        </label>
        <input
          id="support-subject"
          value={subject}
          disabled={locked}
          onChange={(event) => setSubject(event.target.value)}
          required
          minLength={5}
          maxLength={120}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
          placeholder={copy.subjectPlaceholder}
        />
      </div>
      <div>
        <label htmlFor="support-message" className="text-sm font-medium">
          {copy.message}
        </label>
        <textarea
          id="support-message"
          value={message}
          disabled={locked}
          onChange={(event) => setMessage(event.target.value)}
          required
          minLength={20}
          maxLength={4000}
          rows={6}
          aria-describedby="support-privacy"
          className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm"
          placeholder={copy.messagePlaceholder}
        />
        <p id="support-privacy" className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {copy.privacyNotice}
        </p>
      </div>
      {notice && (
        <p role="alert" className="rounded-lg border border-border p-3 text-sm">
          {notice}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? copy.submitting : attempt ? copy.retry : copy.submit}
      </button>
    </form>
  );
}
