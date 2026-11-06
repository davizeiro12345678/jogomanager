import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSignedIn } from "@/hooks/useCareer";
import { MODERATION_MESSAGES, moderateMessage } from "@/lib/moderation";
import { sendChatMessage } from "@/lib/chat.functions";
import { reportChatMessage as submitChatReport } from "@/lib/community.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorPanel, SkeletonRows } from "./screen-kit";

interface ChatMessage {
  id: string;
  user_id: string;
  display_name: string;
  body: string;
  hidden: boolean;
  created_at: string;
}

const BLOCKED_KEY = "manager3d.chat.blockedUsers";
const REPORTED_KEY = "manager3d.chat.reportedMessages";

function readIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeIds(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore quota errors */
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr} h`;
  const day = Math.floor(hr / 24);
  return `há ${day} d`;
}

/**
 * Sala de chat global reutilizável: usada na página /chat e também dentro da
 * partida, numa gaveta. `next` define para onde voltar após o login.
 */
export function ChatPanel({ next = "/chat" }: { next?: string }) {
  const signedIn = useSignedIn();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState<Set<string>>(new Set());
  const reportsInFlight = useRef(new Set<string>());
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBlockedUsers(readIds(BLOCKED_KEY));
    setReported(readIds(REPORTED_KEY));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user) setUserId(user.id);
    });
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    setLoading(true);
    setLoadError(false);
    void supabase
      .from("chat_messages")
      .select("id, user_id, display_name, body, hidden, created_at")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setLoadError(true);
          setLoading(false);
          return;
        }
        setMessages(((data ?? []) as ChatMessage[]).reverse());
        setLoading(false);
      });

    const channel = supabase
      .channel("chat_messages_room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as ChatMessage;
          if (row.hidden) return;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row].slice(-200),
          );
        },
      )
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [signedIn, refresh]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [messages]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !blockedUsers.has(m.user_id) && !reported.has(m.id)),
    [messages, blockedUsers, reported],
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    // Instant hint only; the server repeats the check and decides.
    const rule = moderateMessage(body);
    if (rule) {
      toast.error(MODERATION_MESSAGES[rule]);
      return;
    }
    setSending(true);
    // Envio pelo servidor: a identidade vem do token verificado (não do
    // navegador) e há moderação, silenciamento e limite por minuto.
    const result = await sendChatMessage({ data: { body } }).catch(() => null);
    setSending(false);
    if (!result || !result.ok) {
      toast.error(
        !result
          ? "Não foi possível enviar a mensagem."
          : result.reason === "blocked" || result.reason === "muted"
            ? result.message
            : result.reason === "rate_limited"
              ? "Calma! Você está enviando mensagens rápido demais."
              : result.reason === "invalid_length"
                ? "A mensagem precisa ter entre 1 e 500 caracteres."
                : "Não foi possível enviar a mensagem.",
      );
      return;
    }
    setDraft("");
  }, [draft, sending]);

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar a mensagem.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const reportMessage = useCallback(async (id: string) => {
    if (reportsInFlight.current.has(id)) return;
    reportsInFlight.current.add(id);
    setReporting(new Set(reportsInFlight.current));
    const result = await submitChatReport({
      data: {
        messageId: id,
        reason: "Mensagem denunciada pelo participante do chat",
      },
    }).catch(() => null);
    reportsInFlight.current.delete(id);
    setReporting(new Set(reportsInFlight.current));
    if (!result?.ok) {
      toast.error(
        "Não foi possível enviar a denúncia. A mensagem foi preservada; tente novamente.",
      );
      return;
    }
    setReported((prev) => {
      const nextIds = new Set(prev).add(id);
      writeIds(REPORTED_KEY, nextIds);
      return nextIds;
    });
    toast.success("Mensagem denunciada e ocultada para você.");
  }, []);

  const blockUser = useCallback((id: string) => {
    setBlockedUsers((prev) => {
      const nextIds = new Set(prev).add(id);
      writeIds(BLOCKED_KEY, nextIds);
      return nextIds;
    });
    toast.success("Usuário bloqueado. Você não verá mais mensagens dele.");
  }, []);

  if (signedIn === null) {
    return <SkeletonRows rows={3} />;
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/85 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Entre na sua conta para ler e enviar mensagens na sala dos técnicos.
        </p>
        <Link
          to="/auth"
          search={{ next }}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
        >
          Entrar para conversar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/60 surface-card p-4">
        {loading ? (
          <SkeletonRows label="Carregando mensagens" />
        ) : loadError ? (
          <ErrorPanel
            hint="Não foi possível carregar o chat."
            onRetry={() => setRefresh((value) => value + 1)}
          />
        ) : visibleMessages.length === 0 ? (
          <EmptyState
            title="A conversa começa aqui"
            hint="Escreva uma mensagem para cumprimentar os treinadores."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleMessages.map((m) => (
              <li key={m.id} className="group flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xs uppercase tracking-wide text-primary">
                    {m.display_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {relativeTime(m.created_at)}
                  </span>
                </div>
                <p className="break-words text-sm text-foreground">{m.body}</p>
                <div className="flex gap-1">
                  {m.user_id === userId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void deleteMessage(m.id)}
                      className="min-h-11 text-xs text-destructive"
                    >
                      Apagar
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={reporting.has(m.id)}
                        onClick={() => void reportMessage(m.id)}
                        className="min-h-11 text-xs text-muted-foreground"
                      >
                        {reporting.has(m.id) ? "Enviando…" : "Denunciar"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => blockUser(m.user_id)}
                        className="min-h-11 text-xs text-muted-foreground"
                      >
                        Bloquear usuário
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Escreva sua mensagem…"
          className="min-h-[44px] flex-1 resize-none"
          maxLength={500}
          aria-label="Mensagem"
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
