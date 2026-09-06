import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSignedIn } from "@/hooks/useCareer";
import { containsProfanity, PROFANITY_BLOCKED_MESSAGE } from "@/lib/moderation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Chat global · Pro Football Manager 3D" },
      {
        name: "description",
        content: "Converse em tempo real com outros técnicos na sala de chat global do jogo.",
      },
      { property: "og:title", content: "Chat global · Pro Football Manager 3D" },
      { property: "og:description", content: "Bata um papo com outros técnicos em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

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

function ChatPage() {
  const signedIn = useSignedIn();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("Técnico");
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(() => readIds(BLOCKED_KEY));
  const [reported, setReported] = useState<Set<string>>(() => readIds(REPORTED_KEY));
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      setUserId(user.id);
      const name =
        (user.user_metadata?.["display_name"] as string | undefined) ||
        user.email?.split("@")[0] ||
        "Técnico";
      setDisplayName(name);
    });
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    setLoading(true);
    supabase
      .from("chat_messages")
      .select("id, user_id, display_name, body, hidden, created_at")
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          toast.error("Não foi possível carregar o chat.");
          setLoading(false);
          return;
        }
        setMessages((data ?? []) as ChatMessage[]);
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
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [signedIn]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !blockedUsers.has(m.user_id) && !reported.has(m.id)),
    [messages, blockedUsers, reported],
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    if (containsProfanity(body)) {
      toast.error(PROFANITY_BLOCKED_MESSAGE);
      return;
    }
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      user_id: userId ?? "",
      display_name: displayName,
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setDraft("");
  }, [draft, userId, displayName]);

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar a mensagem.");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const reportMessage = useCallback((id: string) => {
    setReported((prev) => {
      const next = new Set(prev).add(id);
      writeIds(REPORTED_KEY, next);
      return next;
    });
    toast.success("Mensagem denunciada e ocultada para você.");
  }, []);

  const blockUser = useCallback((id: string) => {
    setBlockedUsers((prev) => {
      const next = new Set(prev).add(id);
      writeIds(BLOCKED_KEY, next);
      return next;
    });
    toast.success("Usuário bloqueado. Você não verá mais mensagens dele.");
  }, []);

  if (signedIn === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="pitch-bg flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/85 p-6 text-center backdrop-blur-xl">
          <h1 className="font-display text-lg uppercase tracking-wide">Chat global</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre na sua conta para ler e enviar mensagens na sala de chat dos técnicos.
          </p>
          <Link
            to="/auth"
            search={{ next: "/chat" }}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-display text-sm uppercase tracking-wider text-primary-foreground"
          >
            Entrar para conversar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pitch-bg flex min-h-screen flex-col px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Link to="/dashboard" className="text-xs uppercase tracking-widest text-primary">
              ← Painel
            </Link>
            <h1 className="font-display text-2xl uppercase tracking-wide">Chat global</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto rounded-2xl border border-border/60 bg-card/70 p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando mensagens…</p>
          ) : visibleMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma mensagem ainda. Seja o primeiro a cumprimentar a galera!
            </p>
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
                  <div className="flex gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                    {m.user_id === userId ? (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        className="text-[10px] uppercase tracking-wide text-destructive hover:underline"
                      >
                        Apagar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => reportMessage(m.id)}
                          className="text-[10px] uppercase tracking-wide text-muted-foreground hover:underline"
                        >
                          Denunciar
                        </button>
                        <button
                          onClick={() => blockUser(m.user_id)}
                          className="text-[10px] uppercase tracking-wide text-muted-foreground hover:underline"
                        >
                          Bloquear usuário
                        </button>
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
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}
