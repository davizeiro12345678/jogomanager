-- Only opaque identity/time buckets are retained; message content is never stored.
CREATE TABLE public.room_chat_rate_limits (
  user_id uuid NOT NULL,
  second_bucket bigint NOT NULL,
  PRIMARY KEY (user_id, second_bucket)
);
ALTER TABLE public.room_chat_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.room_chat_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.room_chat_rate_limits TO service_role;
