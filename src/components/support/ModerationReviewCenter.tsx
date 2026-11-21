import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthUserId } from "@/hooks/useAuthUserId";
import { useT } from "@/i18n/provider";
import { moderationReviewMessages } from "@/i18n/moderation-review-messages";
import { mayShowModerationData } from "@/lib/moderation-identity";
import {
  decideModerationAppeal,
  decideModerationCase,
  listOpenModerationCases,
  listOwnModerationDecisions,
  listPendingModerationAppeals,
  submitModerationAppeal,
} from "@/lib/moderation-review.functions";

type OwnDecision = {
  caseId: string;
  decision: "dismissed" | "warning" | "temporary_mute";
  createdAt: string;
  appealState: "open" | "upheld" | "overturned" | null;
};
type ReviewCase = {
  caseId: string;
  roomId: string;
  reporterId: string;
  subjectId: string;
  state: "open";
  revision: number;
  createdAt: string;
  subject: string;
  report: string;
};
type PendingAppeal = {
  appealId: string;
  caseId: string;
  appellantId: string;
  message: string;
  createdAt: string;
};
type CaseDecision = "dismissed" | "warning" | "temporary_mute";
type AppealDecision = "upheld" | "overturned";

/**
 * On-demand review surface. The backend never returns another player's
 * decision history, moderator access requires private allowlisting, and all
 * mutations are server-side with authenticated caller identity.
 */
export function ModerationReviewCenter() {
  const { lang } = useT();
  const copy = moderationReviewMessages(lang);
  const userId = useAuthUserId();
  const listMine = useServerFn(listOwnModerationDecisions);
  const listCases = useServerFn(listOpenModerationCases);
  const listAppeals = useServerFn(listPendingModerationAppeals);
  const submitAppeal = useServerFn(submitModerationAppeal);
  const resolveCase = useServerFn(decideModerationCase);
  const resolveAppeal = useServerFn(decideModerationAppeal);
  const [own, setOwn] = useState<OwnDecision[]>([]);
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [appeals, setAppeals] = useState<PendingAppeal[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [appealFor, setAppealFor] = useState<string | null>(null);
  const [appealText, setAppealText] = useState("");
  const [caseFor, setCaseFor] = useState<string | null>(null);
  const [caseDecision, setCaseDecision] = useState<CaseDecision>("warning");
  const [caseNote, setCaseNote] = useState("");
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [reviewDecision, setReviewDecision] = useState<AppealDecision>("upheld");
  const [reviewNote, setReviewNote] = useState("");
  const request = useRef<{ caseId: string; message: string; requestId: string } | null>(null);
  // Private review data belongs to one authenticated identity. A login switch
  // must hide previous results immediately, before effects or fetches settle.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const currentUser = useRef(userId);
  useEffect(() => {
    currentUser.current = userId;
    request.current = null;
    setAppealFor(null);
    setCaseFor(null);
    setReviewFor(null);
    setBusy(false);
    setNotice("");
  }, [userId]);

  async function reload(): Promise<void> {
    const requestedFor = userId;
    if (!requestedFor) return;
    const [myResult, caseResult, appealResult] = await Promise.allSettled([
      listMine({ data: { limit: 20 } }),
      listCases({ data: { limit: 20 } }),
      listAppeals({ data: { limit: 20 } }),
    ]);
    if (currentUser.current !== requestedFor) return;
    if (myResult.status === "fulfilled" && myResult.value.ok) {
      setOwn(myResult.value.entries);
      setEnabled(true);
    } else if (myResult.status === "fulfilled" && !myResult.value.ok) {
      setNotice(myResult.value.reason === "unavailable" ? copy.disabledNotice : copy.queryFailed);
    } else setNotice(copy.moderationFailed);
    setCases(
      caseResult.status === "fulfilled" && caseResult.value.ok ? caseResult.value.entries : [],
    );
    setAppeals(
      appealResult.status === "fulfilled" && appealResult.value.ok
        ? appealResult.value.entries
        : [],
    );
    setLoadedFor(requestedFor);
  }

  useEffect(() => {
    if (!userId) {
      setOwn([]);
      setCases([]);
      setAppeals([]);
      setEnabled(false);
      setLoadedFor(null);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const [mine, pending, reviews] = await Promise.allSettled([
          listMine({ data: { limit: 20 } }),
          listCases({ data: { limit: 20 } }),
          listAppeals({ data: { limit: 20 } }),
        ]);
        if (!active || currentUser.current !== userId) return;
        setEnabled(mine.status === "fulfilled" && mine.value.ok);
        setOwn(mine.status === "fulfilled" && mine.value.ok ? mine.value.entries : []);
        setCases(pending.status === "fulfilled" && pending.value.ok ? pending.value.entries : []);
        setAppeals(reviews.status === "fulfilled" && reviews.value.ok ? reviews.value.entries : []);
        setLoadedFor(userId);
      } catch {
        if (active && currentUser.current === userId) {
          setNotice(copy.moderationFailed);
          setLoadedFor(userId);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [userId, listMine, listCases, listAppeals, copy.moderationFailed]);

  async function sendAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appealFor || busy || !enabled) return;
    const requestedFor = userId;
    setBusy(true);
    setNotice("");
    const message = appealText.trim();
    if (
      !request.current ||
      request.current.caseId !== appealFor ||
      request.current.message !== message
    )
      request.current = { caseId: appealFor, message, requestId: crypto.randomUUID() };
    try {
      const result = await submitAppeal({
        data: { caseId: appealFor, requestId: request.current.requestId, message },
      });
      if (currentUser.current !== requestedFor) return;
      if (!result.ok) throw new Error(result.reason);
      request.current = null;
      setAppealFor(null);
      setAppealText("");
      setNotice(copy.appealReceived);
      await reload();
    } catch {
      if (currentUser.current === requestedFor) setNotice(copy.appealFailed);
    } finally {
      if (currentUser.current === requestedFor) setBusy(false);
    }
  }

  async function sendCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = cases.find((item) => item.caseId === caseFor);
    if (!selected || busy) return;
    const requestedFor = userId;
    setBusy(true);
    setNotice("");
    try {
      const result = await resolveCase({
        data: {
          caseId: selected.caseId,
          expectedRevision: selected.revision,
          decision: caseDecision,
          note: caseNote.trim(),
        },
      });
      if (currentUser.current !== requestedFor) return;
      if (!result.ok) throw new Error(result.reason);
      setCaseFor(null);
      setCaseNote("");
      setNotice(copy.decisionSaved);
      await reload();
    } catch {
      if (currentUser.current === requestedFor) setNotice(copy.decisionFailed);
    } finally {
      if (currentUser.current === requestedFor) setBusy(false);
    }
  }

  async function sendReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewFor || busy) return;
    const requestedFor = userId;
    setBusy(true);
    setNotice("");
    try {
      const result = await resolveAppeal({
        data: {
          appealId: reviewFor,
          decision: reviewDecision,
          note: reviewNote.trim(),
        },
      });
      if (currentUser.current !== requestedFor) return;
      if (!result.ok) throw new Error(result.reason);
      setReviewFor(null);
      setReviewNote("");
      setNotice(copy.reviewSaved);
      await reload();
    } catch {
      if (currentUser.current === requestedFor) setNotice(copy.reviewFailed);
    } finally {
      if (currentUser.current === requestedFor) setBusy(false);
    }
  }

  if (!userId) return <p className="text-sm text-muted-foreground">{copy.signIn}</p>;
  if (!mayShowModerationData(userId, loadedFor))
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {copy.loading}
      </p>
    );

  return (
    <section
      aria-labelledby="moderation-center-title"
      className="mt-6 space-y-4 rounded-xl border border-border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="moderation-center-title" className="font-display text-lg">
            {copy.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          disabled={busy}
          className="min-h-11 rounded-lg border border-border px-3 text-sm"
        >
          {copy.refresh}
        </button>
      </div>
      {notice ? (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {!enabled ? (
        <p className="text-sm text-muted-foreground">{copy.unavailable}</p>
      ) : (
        <div className="space-y-3">
          <h4 className="font-semibold">{copy.ownTitle}</h4>
          {own.length === 0 ? <p className="text-sm text-muted-foreground">{copy.empty}</p> : null}
          {own.map((item) => (
            <div key={item.caseId} className="rounded-lg border border-border p-3 text-sm">
              <p>
                {copy.decision} <strong>{item.decision}</strong>. {copy.appeal}{" "}
                {item.appealState ?? copy.notSent}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {copy.case} {item.caseId}
              </p>
              {item.decision !== "dismissed" && item.appealState === null ? (
                <button
                  type="button"
                  onClick={() => setAppealFor(item.caseId)}
                  className="mt-3 min-h-11 rounded-lg border border-primary px-3 text-primary"
                >
                  {copy.requestAppeal}
                </button>
              ) : null}
            </div>
          ))}
          {appealFor ? (
            <form
              onSubmit={(event) => void sendAppeal(event)}
              className="space-y-2 rounded-lg border border-primary/50 p-3"
            >
              <label htmlFor="moderation-appeal-message" className="block text-sm font-medium">
                {copy.appealReason}
              </label>
              <textarea
                id="moderation-appeal-message"
                value={appealText}
                onChange={(event) => setAppealText(event.target.value)}
                minLength={20}
                maxLength={2000}
                required
                rows={4}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground"
              >
                {copy.sendAppeal}
              </button>
            </form>
          ) : null}
        </div>
      )}
      {cases.length > 0 ? (
        <section className="space-y-3" aria-label={copy.roomCases}>
          <h4 className="font-semibold">
            {copy.roomCasesTitle} ({cases.length})
          </h4>
          {cases.map((item) => (
            <div key={item.caseId} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{item.subject}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                {item.report}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.room} {item.roomId}
              </p>
              <button
                type="button"
                onClick={() => setCaseFor(item.caseId)}
                className="mt-3 min-h-11 rounded-lg border border-border px-3"
              >
                {copy.reviewCase}
              </button>
              {caseFor === item.caseId ? (
                <form onSubmit={(event) => void sendCase(event)} className="mt-3 space-y-2">
                  <label htmlFor="moderation-case-decision" className="block font-medium">
                    {copy.decisionLabel}
                  </label>
                  <select
                    id="moderation-case-decision"
                    value={caseDecision}
                    onChange={(event) => setCaseDecision(event.target.value as CaseDecision)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background p-2"
                  >
                    <option value="dismissed">{copy.dismissed}</option>
                    <option value="warning">{copy.warning}</option>
                    <option value="temporary_mute">{copy.temporaryMute}</option>
                  </select>
                  <label htmlFor="moderation-case-note" className="block font-medium">
                    {copy.caseReason}
                  </label>
                  <textarea
                    id="moderation-case-note"
                    value={caseNote}
                    onChange={(event) => setCaseNote(event.target.value)}
                    minLength={10}
                    maxLength={1000}
                    required
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background p-2"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground"
                  >
                    {copy.confirmDecision}
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {appeals.length > 0 ? (
        <section className="space-y-3" aria-label={copy.appealQueue}>
          <h4 className="font-semibold">
            {copy.appealsTitle} ({appeals.length})
          </h4>
          {appeals.map((item) => (
            <div key={item.appealId} className="rounded-lg border border-border p-3 text-sm">
              <p className="whitespace-pre-wrap break-words">{item.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {copy.caseLabel} {item.caseId}
              </p>
              <button
                type="button"
                onClick={() => setReviewFor(item.appealId)}
                className="mt-3 min-h-11 rounded-lg border border-border px-3"
              >
                {copy.reviewAppeal}
              </button>
              {reviewFor === item.appealId ? (
                <form onSubmit={(event) => void sendReview(event)} className="mt-3 space-y-2">
                  <label htmlFor="moderation-review-decision" className="block font-medium">
                    {copy.reviewResult}
                  </label>
                  <select
                    id="moderation-review-decision"
                    value={reviewDecision}
                    onChange={(event) => setReviewDecision(event.target.value as AppealDecision)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background p-2"
                  >
                    <option value="upheld">{copy.upheld}</option>
                    <option value="overturned">{copy.overturned}</option>
                  </select>
                  <label htmlFor="moderation-review-note" className="block font-medium">
                    {copy.reviewReason}
                  </label>
                  <textarea
                    id="moderation-review-note"
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    minLength={10}
                    maxLength={1000}
                    required
                    rows={3}
                    className="w-full rounded-lg border border-border bg-background p-2"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground"
                  >
                    {copy.confirmReview}
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}
