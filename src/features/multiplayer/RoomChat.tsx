import { Flag, Send, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { roomChatMessages } from "@/i18n/room-chat-messages";
import { supabase } from "@/integrations/supabase/client";
import { canJoinRoomChat } from "@/lib/room-chat-access";
import { appendRoomChatMessage } from "@/lib/room-chat-messages";

type RoomChatMessage = { id: string; text: string; senderId: string; createdAt: string };

type RoomChatStatus = "checking" | "ready" | "unavailable";

const ROOM_CHAT_MAX_TEXT_LENGTH = 200;
const ROOM_CHAT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRoomChatMessage(payload: unknown): RoomChatMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.length !== 4 ||
    !keys.includes("id") ||
    !keys.includes("text") ||
    !keys.includes("senderId") ||
    !keys.includes("createdAt")
  )
    return null;
  const rawId = record["id"];
  const rawText = record["text"];
  const senderId = record["senderId"];
  const createdAt = record["createdAt"];
  if (
    typeof rawId !== "string" ||
    typeof rawText !== "string" ||
    typeof senderId !== "string" ||
    typeof createdAt !== "string"
  )
    return null;
  if (
    rawId.length > 100 ||
    rawId.trim() !== rawId ||
    !ROOM_CHAT_ID_PATTERN.test(rawId) ||
    rawText.length < 1 ||
    rawText.length > ROOM_CHAT_MAX_TEXT_LENGTH ||
    rawText.trim() !== rawText
  ) {
    return null;
  }
  if (!ROOM_CHAT_ID_PATTERN.test(senderId) || !Number.isFinite(Date.parse(createdAt))) return null;
  return { id: rawId, text: rawText, senderId, createdAt };
}

/** Chat da sala por canal privado em tempo real (não fica salvo). */
export function RoomChat({ roomId, userId }: { roomId: string; userId: string }) {
  const { t, lang } = useT();
  const copy = roomChatMessages(lang);
  const messageInputLabel = copy.message;
  const [msgs, setMsgs] = useState<RoomChatMessage[]>([]);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomChatStatus>("checking");
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingSend = useRef<{ text: string; id: string } | null>(null);
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [hideOpponent, setHideOpponent] = useState(false);

  useEffect(() => {
    let disposed = false;
    setMsgs([]);
    setFeedback(null);
    setStatus("checking");

    const joinRoomChat = async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (disposed) return;
        if (authError || !user || user.id !== userId) {
          setStatus("unavailable");
          return;
        }

        const { data: membership, error: membershipError } = await supabase
          .from("match_rooms")
          .select("id, host_id, guest_id, status")
          .eq("id", roomId)
          .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
          .in("status", ["open", "ready", "live", "settling"])
          .maybeSingle();
        if (disposed) return;
        if (membershipError || !membership || !canJoinRoomChat(membership, user.id)) {
          setStatus("unavailable");
          return;
        }

        // The UI check improves feedback; realtime.messages RLS is the security boundary.
        await supabase.realtime.setAuth();
      } catch {
        if (!disposed) setStatus("unavailable");
        return;
      }
      if (disposed) return;

      const ch = supabase.channel(`room-chat-${roomId}`, {
        config: { private: true, broadcast: { self: true } },
      });
      ch.on("broadcast", { event: "msg" }, ({ payload }) => {
        const message = parseRoomChatMessage(payload);
        if (!message) return;
        setMsgs((current) => appendRoomChatMessage(current, message));
      }).subscribe((channelStatus) => {
        if (disposed) return;
        if (channelStatus === "SUBSCRIBED") {
          setStatus("ready");
          return;
        }
        if (
          channelStatus === "CHANNEL_ERROR" ||
          channelStatus === "TIMED_OUT" ||
          channelStatus === "CLOSED"
        ) {
          setStatus("unavailable");
          void supabase.removeChannel(ch);
          if (chanRef.current === ch) chanRef.current = null;
        }
      });
      chanRef.current = ch;
    };

    void joinRoomChat();
    return () => {
      disposed = true;
      const ch = chanRef.current;
      if (ch) void supabase.removeChannel(ch);
      chanRef.current = null;
    };
  }, [roomId, userId]);

  return (
    <div className="mt-5 rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.16em]">
          {copy.heading}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={hideOpponent}
            aria-label={hideOpponent ? copy.showOpponent : copy.hideOpponent}
            onClick={() => setHideOpponent((previous) => !previous)}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {hideOpponent ? <VolumeX size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
            {hideOpponent ? copy.show : copy.mute}
          </button>
          <a
            href={`/contato?reportRoom=${encodeURIComponent(roomId)}`}
            aria-label={copy.reportLabel}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Flag size={14} aria-hidden />
            {copy.report}
          </a>
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto text-sm" aria-live="polite">
        {status === "checking" ? (
          <p className="text-xs text-muted-foreground">{copy.checking}</p>
        ) : status === "unavailable" ? (
          <p className="text-xs text-muted-foreground">{copy.unavailable}</p>
        ) : msgs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{copy.empty}</p>
        ) : (
          msgs
            .filter((m) => !hideOpponent || m.senderId === userId)
            .map((m) => (
              <p key={`${m.senderId}:${m.id}`} className="mb-1">
                <span className="text-muted-foreground">
                  {m.senderId === userId ? copy.you : copy.opponent}:{" "}
                </span>
                {m.text}
              </p>
            ))
        )}
      </div>
      {hideOpponent ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {copy.hidden}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = text.trim();
          const channel = chanRef.current;
          if (
            !value ||
            value.length > ROOM_CHAT_MAX_TEXT_LENGTH ||
            status !== "ready" ||
            !channel ||
            sendingRef.current
          ) {
            return;
          }
          setFeedback(null);
          sendingRef.current = true;
          setSending(true);
          // Reuse the same client ID after an uncertain response.
          if (!pendingSend.current || pendingSend.current.text !== value)
            pendingSend.current = { text: value, id: crypto.randomUUID() };
          const clientMessageId = pendingSend.current.id;
          void import("@/lib/chat.functions")
            .then(({ sendRoomChatMessage }) =>
              sendRoomChatMessage({ data: { roomId, text: value, clientMessageId } }),
            )
            .then((result) => {
              if (result.ok) {
                if (pendingSend.current?.id === clientMessageId) pendingSend.current = null;
                setText((current) => (current === value ? "" : current));
                return;
              }
              setFeedback(
                result.message ??
                  (result.reason === "rate_limited" ? t("common.retry") : t("screen.error")),
              );
            })
            .catch(() => {
              setFeedback(t("screen.error"));
            })
            .finally(() => {
              sendingRef.current = false;
              setSending(false);
            });
        }}
        className="mt-2 flex gap-2"
      >
        <label className="sr-only" htmlFor={`room-chat-message-${roomId}`}>
          {messageInputLabel}
        </label>
        <input
          id={`room-chat-message-${roomId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={messageInputLabel}
          maxLength={ROOM_CHAT_MAX_TEXT_LENGTH}
          disabled={status !== "ready" || sending}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          aria-label={copy.send}
          disabled={status !== "ready"}
          className="min-h-11 rounded-lg bg-primary px-3 py-1.5 text-primary-foreground"
        >
          <Send size={14} />
        </button>
      </form>
      {feedback ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
