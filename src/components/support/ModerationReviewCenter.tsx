import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthUserId } from "@/hooks/useAuthUserId";
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

  async function reload(): Promise<void> {
    const [myResult, caseResult, appealResult] = await Promise.allSettled([
      listMine({ data: { limit: 20 } }),
      listCases({ data: { limit: 20 } }),
      listAppeals({ data: { limit: 20 } }),
    ]);
    if (myResult.status === "fulfilled" && myResult.value.ok) {
      setOwn(myResult.value.entries);
      setEnabled(true);
    } else if (myResult.status === "fulfilled" && !myResult.value.ok) {
      setNotice(
        myResult.value.reason === "unavailable"
          ? "A central de revisão ainda não foi ativada."
          : "Não foi possível consultar suas decisões.",
      );
    } else setNotice("Não foi possível consultar a moderação.");
    setCases(caseResult.status === "fulfilled" && caseResult.value.ok ? caseResult.value.entries : []);
    setAppeals(
      appealResult.status === "fulfilled" && appealResult.value.ok ? appealResult.value.entries : [],
    );
  }

  useEffect(() => {
    if (!userId) {
      setOwn([]);
      setCases([]);
      setAppeals([]);
      setEnabled(false);
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
        if (!active) return;
        setEnabled(mine.status === "fulfilled" && mine.value.ok);
        setOwn(mine.status === "fulfilled" && mine.value.ok ? mine.value.entries : []);
        setCases(pending.status === "fulfilled" && pending.value.ok ? pending.value.entries : []);
        setAppeals(reviews.status === "fulfilled" && reviews.value.ok ? reviews.value.entries : []);
      } catch {
        if (active) setNotice("Não foi possível consultar a moderação.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [userId, listMine, listCases, listAppeals]);

  async function sendAppeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appealFor || busy || !enabled) return;
    setBusy(true);
    setNotice("");
    const message = appealText.trim();
    if (!request.current || request.current.caseId !== appealFor || request.current.message !== message)
      request.current = { caseId: appealFor, message, requestId: crypto.randomUUID() };
    try {
      const result = await submitAppeal({
        data: { caseId: appealFor, requestId: request.current.requestId, message },
      });
      if (!result.ok) throw new Error(result.reason);
      request.current = null;
      setAppealFor(null);
      setAppealText("");
      setNotice("Recurso recebido para revisão humana.");
      await reload();
    } catch {
      setNotice("Não foi possível registrar o recurso. Você pode tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = cases.find((item) => item.caseId === caseFor);
    if (!selected || busy) return;
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
      if (!result.ok) throw new Error(result.reason);
      setCaseFor(null);
      setCaseNote("");
      setNotice("Decisão registrada e auditada.");
      await reload();
    } catch {
      setNotice("Não foi possível concluir a decisão. Atualize a fila e verifique as permissões.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewFor || busy) return;
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
      if (!result.ok) throw new Error(result.reason);
      setReviewFor(null);
      setReviewNote("");
      setNotice("Recurso revisado por um moderador independente.");
      await reload();
    } catch {
      setNotice("Revisão indisponível. O moderador original não pode julgar o próprio recurso.");
    } finally {
      setBusy(false);
    }
  }

  if (!userId)
    return <p className="text-sm text-muted-foreground">Entre na sua conta para consultar recursos.</p>;

  return (
    <section aria-labelledby="moderation-center-title" className="mt-6 space-y-4 rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="moderation-center-title" className="font-display text-lg">Moderação e recursos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Decisões são revisadas por pessoas. Não há banimentos permanentes automáticos nesta área.
          </p>
        </div>
        <button type="button" onClick={() => void reload()} disabled={busy} className="min-h-11 rounded-lg border border-border px-3 text-sm">
          Atualizar
        </button>
      </div>
      {notice ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{notice}</p> : null}
      {!enabled ? (
        <p className="text-sm text-muted-foreground">
          A consulta está desativada até a validação e publicação segura do serviço.
        </p>
      ) : (
        <div className="space-y-3">
          <h4 className="font-semibold">Minhas decisões e recursos</h4>
          {own.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma decisão registrada.</p> : null}
          {own.map((item) => (
            <div key={item.caseId} className="rounded-lg border border-border p-3 text-sm">
              <p>Decisão: <strong>{item.decision}</strong>. Recurso: {item.appealState ?? "não enviado"}.</p>
              <p className="mt-1 text-xs text-muted-foreground">Processo {item.caseId}</p>
              {item.decision !== "dismissed" && item.appealState === null ? (
                <button type="button" onClick={() => setAppealFor(item.caseId)} className="mt-3 min-h-11 rounded-lg border border-primary px-3 text-primary">
                  Solicitar revisão humana
                </button>
              ) : null}
            </div>
          ))}
          {appealFor ? (
            <form onSubmit={(event) => void sendAppeal(event)} className="space-y-2 rounded-lg border border-primary/50 p-3">
              <label htmlFor="moderation-appeal-message" className="block text-sm font-medium">
                Explique por que a decisão deve ser revista
              </label>
              <textarea id="moderation-appeal-message" value={appealText} onChange={(event) => setAppealText(event.target.value)}
                minLength={20} maxLength={2000} required rows={4}
                className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground">Enviar recurso</button>
            </form>
          ) : null}
        </div>
      )}
      {cases.length > 0 ? (
        <section className="space-y-3" aria-label="Fila privativa de denúncias">
          <h4 className="font-semibold">Fila de revisão humana ({cases.length})</h4>
          {cases.map((item) => (
            <div key={item.caseId} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{item.subject}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{item.report}</p>
              <p className="mt-2 text-xs text-muted-foreground">Sala: {item.roomId}</p>
              <button type="button" onClick={() => setCaseFor(item.caseId)} className="mt-3 min-h-11 rounded-lg border border-border px-3">
                Revisar denúncia
              </button>
              {caseFor === item.caseId ? (
                <form onSubmit={(event) => void sendCase(event)} className="mt-3 space-y-2">
                  <label htmlFor="moderation-case-decision" className="block font-medium">Decisão</label>
                  <select id="moderation-case-decision" value={caseDecision} onChange={(event) => setCaseDecision(event.target.value as CaseDecision)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background p-2">
                    <option value="dismissed">Arquivar sem punição</option>
                    <option value="warning">Advertência</option>
                    <option value="temporary_mute">Silenciamento temporário para revisão</option>
                  </select>
                  <label htmlFor="moderation-case-note" className="block font-medium">Justificativa privada da decisão</label>
                  <textarea id="moderation-case-note" value={caseNote} onChange={(event) => setCaseNote(event.target.value)}
                    minLength={10} maxLength={1000} required rows={3}
                    className="w-full rounded-lg border border-border bg-background p-2" />
                  <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground">
                    Confirmar decisão
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {appeals.length > 0 ? (
        <section className="space-y-3" aria-label="Fila privativa de recursos">
          <h4 className="font-semibold">Recursos para revisão independente ({appeals.length})</h4>
          {appeals.map((item) => (
            <div key={item.appealId} className="rounded-lg border border-border p-3 text-sm">
              <p className="whitespace-pre-wrap break-words">{item.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">Processo: {item.caseId}</p>
              <button type="button" onClick={() => setReviewFor(item.appealId)} className="mt-3 min-h-11 rounded-lg border border-border px-3">
                Revisar recurso
              </button>
              {reviewFor === item.appealId ? (
                <form onSubmit={(event) => void sendReview(event)} className="mt-3 space-y-2">
                  <label htmlFor="moderation-review-decision" className="block font-medium">Resultado do recurso</label>
                  <select id="moderation-review-decision" value={reviewDecision}
                    onChange={(event) => setReviewDecision(event.target.value as AppealDecision)}
                    className="min-h-11 w-full rounded-lg border border-border bg-background p-2">
                    <option value="upheld">Manter decisão</option>
                    <option value="overturned">Reverter decisão</option>
                  </select>
                  <label htmlFor="moderation-review-note" className="block font-medium">Justificativa independente</label>
                  <textarea id="moderation-review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)}
                    minLength={10} maxLength={1000} required rows={3}
                    className="w-full rounded-lg border border-border bg-background p-2" />
                  <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground">
                    Confirmar revisão
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
